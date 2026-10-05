terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.80, < 7.0" }
  }
}

provider "aws" {
  region              = "ap-south-1"
  profile             = var.aws_profile
  allowed_account_ids = ["327301848391"]
  default_tags {
    tags = { Project = "sapienworx", Environment = "beta", Component = "cv-scanner", ManagedBy = "Terraform" }
  }
}

variable "aws_profile" { default = "sapienworx_admin" }
variable "scanner_image" {
  type = string
  validation {
    condition     = can(regex("^327301848391\\.dkr\\.ecr\\.ap-south-1\\.amazonaws\\.com/sapienworx-beta/scanner@sha256:[a-f0-9]{64}$", var.scanner_image))
    error_message = "Use an immutable digest in the beta scanner ECR repository."
  }
}
variable "desired_count" {
  default = 0
  validation {
    condition     = contains([0, 1], var.desired_count)
    error_message = "Beta scanner is paused or one task; no autoscaling."
  }
}

locals {
  name   = "sapienworx-beta-scanner"
  vpc_id = "vpc-0bd9180256c8ce970"
}

data "aws_instance" "beta_host" { instance_id = "i-0356b55e3d7eaf72a" }

# A scanner-owned subnet/route table avoids editing production database routes.
# No NAT, internet default route, public IP, ALB or public DNS.
resource "aws_subnet" "scanner" {
  vpc_id                  = local.vpc_id
  cidr_block              = "10.42.20.0/24"
  availability_zone       = "ap-south-1a"
  map_public_ip_on_launch = false
  tags                    = { Name = local.name }
}
resource "aws_route_table" "scanner" { vpc_id = local.vpc_id }
resource "aws_route_table_association" "scanner" {
  subnet_id      = aws_subnet.scanner.id
  route_table_id = aws_route_table.scanner.id
}

resource "aws_security_group" "scanner" {
  name   = local.name
  vpc_id = local.vpc_id
  ingress {
    protocol    = "tcp"
    from_port   = 3310
    to_port     = 3310
    cidr_blocks = ["${data.aws_instance.beta_host.private_ip}/32"]
    description = "Approved beta host only; backend-only host firewall is an activation prerequisite"
  }
  egress {
    protocol        = "tcp"
    from_port       = 443
    to_port         = 443
    security_groups = [aws_security_group.endpoints.id]
  }
  egress {
    protocol        = "tcp"
    from_port       = 443
    to_port         = 443
    prefix_list_ids = [aws_vpc_endpoint.s3.prefix_list_id]
  }
}
resource "aws_security_group" "endpoints" {
  name   = "${local.name}-endpoints"
  vpc_id = local.vpc_id
  ingress {
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = [aws_subnet.scanner.cidr_block]
  }
  # ECR private DNS applies VPC-wide: preserve existing host image pulls.
  ingress {
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["${data.aws_instance.beta_host.private_ip}/32"]
  }
}
resource "aws_vpc_endpoint" "interface" {
  for_each            = toset(["ecr.api", "ecr.dkr", "logs"])
  vpc_id              = local.vpc_id
  service_name        = "com.amazonaws.ap-south-1.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.scanner.id]
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true
}
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = local.vpc_id
  service_name      = "com.amazonaws.ap-south-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.scanner.id]
  policy            = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = "*", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.signatures.arn}/*", "arn:aws:s3:::prod-ap-south-1-starport-layer-bucket/*"] }] })
}

resource "aws_ecr_repository" "scanner" {
  name                 = "sapienworx-beta/scanner"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
}
resource "aws_s3_bucket" "signatures" { bucket = "sapienworx-beta-scanner-signatures-327301848391-ap-south-1" }
resource "aws_s3_bucket_public_access_block" "signatures" {
  bucket                  = aws_s3_bucket.signatures.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "signatures" {
  bucket = aws_s3_bucket.signatures.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "signatures" {
  bucket = aws_s3_bucket.signatures.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_policy" "signatures" {
  bucket = aws_s3_bucket.signatures.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Sid = "RequireTLS", Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [aws_s3_bucket.signatures.arn, "${aws_s3_bucket.signatures.arn}/*"], Condition = { Bool = { "aws:SecureTransport" = "false" } } }] })
}
resource "aws_cloudwatch_log_group" "scanner" {
  name              = "/sapienworx/beta/scanner"
  retention_in_days = 7
}

locals {
  task_trust = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = local.task_trust
}
resource "aws_iam_role_policy" "execution" {
  role = aws_iam_role.execution.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"], Resource = aws_ecr_repository.scanner.arn },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.scanner.arn}:*" }
  ] })
}
resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = local.task_trust
}
resource "aws_iam_role_policy" "task" {
  role = aws_iam_role.task.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["s3:GetObject"], Resource = "${aws_s3_bucket.signatures.arn}/verified/*" },
    { Effect = "Deny", Action = ["s3:*"], Resource = ["arn:aws:s3:::sapienworx-beta-documents-*", "arn:aws:s3:::sapienworx-beta-documents-*/*", "arn:aws:s3:::sapienworx-production-*", "arn:aws:s3:::sapienworx-production-*/*"] }
  ] })
}

resource "aws_service_discovery_private_dns_namespace" "scanner" {
  name = "beta-scanner.sapienworx.internal"
  vpc  = local.vpc_id
}
resource "aws_service_discovery_service" "scanner" {
  name = "clamd"
  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.scanner.id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  health_check_custom_config {}
}
resource "aws_ecs_cluster" "scanner" { name = local.name }
resource "aws_ecs_task_definition" "scanner" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "4096"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
  volume { name = "signatures" }
  volume { name = "temporary" }
  container_definitions = jsonencode([{
    name             = "clamd", image = var.scanner_image, essential = true, readonlyRootFilesystem = true,
    cpu              = 1024, memory = 4096,
    linuxParameters  = { capabilities = { drop = ["ALL"] }, initProcessEnabled = true },
    portMappings     = [{ containerPort = 3310, protocol = "tcp" }],
    environment      = [{ name = "AWS_DEFAULT_REGION", value = "ap-south-1" }, { name = "SIGNATURE_BUCKET", value = aws_s3_bucket.signatures.id }],
    mountPoints      = [{ sourceVolume = "signatures", containerPath = "/var/lib/clamav", readOnly = false }, { sourceVolume = "temporary", containerPath = "/tmp", readOnly = false }],
    healthCheck      = { command = ["CMD", "python3", "/scanner/health.py"], interval = 30, timeout = 5, retries = 3, startPeriod = 300 },
    logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.scanner.name, awslogs-region = "ap-south-1", awslogs-stream-prefix = "health" } }
  }])
}
resource "aws_ecs_service" "scanner" {
  name                               = local.name
  cluster                            = aws_ecs_cluster.scanner.id
  task_definition                    = aws_ecs_task_definition.scanner.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "1.4.0"
  enable_execute_command             = false
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = [aws_subnet.scanner.id]
    security_groups  = [aws_security_group.scanner.id]
    assign_public_ip = false
  }
  service_registries { registry_arn = aws_service_discovery_service.scanner.arn }
  depends_on = [aws_vpc_endpoint.interface, aws_vpc_endpoint.s3, aws_iam_role_policy.execution, aws_iam_role_policy.task]
}
output "private_scanner_endpoint" { value = "tcp://clamd.beta-scanner.sapienworx.internal:3310" }
output "signature_bucket" { value = aws_s3_bucket.signatures.id }

# A separately approved maintenance runner uses beta GitHub OIDC. It can publish
# signatures only, and cannot deploy tasks or read document buckets/secrets.
resource "aws_iam_role" "signature_publisher" {
  name = "${local.name}-signature-publisher"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect    = "Allow", Action = "sts:AssumeRoleWithWebIdentity",
    Principal = { Federated = "arn:aws:iam::327301848391:oidc-provider/token.actions.githubusercontent.com" },
    Condition = { StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com", "token.actions.githubusercontent.com:sub" = "repo:TechiAkki963@57339768/SapienWorx@1340540005:environment:beta" } }
  }] })
}
resource "aws_iam_role_policy" "signature_publisher" {
  role   = aws_iam_role.signature_publisher.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["s3:PutObject"], Resource = "${aws_s3_bucket.signatures.arn}/verified/*" }] })
}
output "signature_publisher_role" { value = aws_iam_role.signature_publisher.arn }
