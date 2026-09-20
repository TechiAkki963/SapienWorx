resource "aws_security_group" "application" {
  name        = "${local.name_prefix}-application"
  description = "Public HTTPS/HTTP ingress for Caddy; no administrative ingress"
  vpc_id      = aws_vpc.production.id

  revoke_rules_on_delete = true
  tags                   = { Name = "${local.name_prefix}-application" }
}

resource "aws_vpc_security_group_ingress_rule" "application_http" {
  security_group_id = aws_security_group.application.id
  description       = "Public HTTP for redirect and ACME"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "application_https" {
  security_group_id = aws_security_group.application.id
  description       = "Public HTTPS"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "application_https" {
  security_group_id = aws_security_group.application.id
  description       = "AWS APIs, ECR, S3 and certificate services"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "application_http" {
  security_group_id = aws_security_group.application.id
  description       = "Package repositories and certificate redirects"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "application_dns_udp" {
  security_group_id = aws_security_group.application.id
  description       = "VPC DNS resolver"
  cidr_ipv4         = "${cidrhost(var.vpc_cidr, 2)}/32"
  from_port         = 53
  to_port           = 53
  ip_protocol       = "udp"
}

resource "aws_vpc_security_group_egress_rule" "application_dns_tcp" {
  security_group_id = aws_security_group.application.id
  description       = "VPC DNS resolver fallback"
  cidr_ipv4         = "${cidrhost(var.vpc_cidr, 2)}/32"
  from_port         = 53
  to_port           = 53
  ip_protocol       = "tcp"
}

resource "aws_security_group" "database" {
  name        = "${local.name_prefix}-database"
  description = "Private PostgreSQL access from the application host only"
  vpc_id      = aws_vpc.production.id

  revoke_rules_on_delete = true
  tags                   = { Name = "${local.name_prefix}-database" }
}

resource "aws_vpc_security_group_ingress_rule" "database_postgresql" {
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.application.id
  description                  = "PostgreSQL from application security group"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "application_postgresql" {
  security_group_id            = aws_security_group.application.id
  referenced_security_group_id = aws_security_group.database.id
  description                  = "PostgreSQL to private RDS"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
