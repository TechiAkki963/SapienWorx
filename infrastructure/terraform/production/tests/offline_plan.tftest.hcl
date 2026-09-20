mock_provider "aws" {}

run "production_safety_plan" {
  command = plan

  override_data {
    target = data.aws_caller_identity.current
    values = {
      account_id = "123456789012"
      arn        = "arn:aws:iam::123456789012:user/offline-plan"
      id         = "123456789012"
    }
  }

  override_data {
    target = data.aws_partition.current
    values = {
      partition  = "aws"
      dns_suffix = "amazonaws.com"
    }
  }

  override_data {
    target = data.aws_ssm_parameter.al2023_arm64_ami
    values = {
      name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
      type  = "String"
      value = "ami-0123456789abcdef0"
    }
  }

  override_data {
    target = data.aws_iam_policy_document.documents_bucket
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  override_data {
    target = data.aws_iam_policy_document.ec2_assume_role
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  override_data {
    target = data.aws_iam_policy_document.application
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  override_data {
    target = data.aws_iam_policy_document.github_assume_role
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  override_data {
    target = data.aws_iam_policy_document.github_deployment
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  assert {
    condition     = aws_db_instance.production.publicly_accessible == false
    error_message = "RDS must remain private."
  }

  assert {
    condition     = aws_db_instance.production.storage_encrypted
    error_message = "RDS storage must remain encrypted."
  }

  assert {
    condition     = aws_instance.application.metadata_options[0].http_tokens == "required"
    error_message = "IMDSv2 must remain required."
  }

  assert {
    condition = (
      aws_subnet.public_ap_south_1c.cidr_block == "10.42.2.0/24" &&
      aws_subnet.public_ap_south_1c.availability_zone == "ap-south-1c" &&
      aws_subnet.public_ap_south_1c.map_public_ip_on_launch == false
    )
    error_message = "The capacity-recovery subnet must remain 10.42.2.0/24 in ap-south-1c without automatic public IP assignment."
  }

  assert {
    condition = (
      aws_instance.application.instance_type == "m6g.medium" &&
      length(aws_instance.application.credit_specification) == 0 &&
      aws_instance.application.root_block_device[0].volume_type == "gp3" &&
      aws_instance.application.root_block_device[0].volume_size == 20 &&
      aws_instance.application.root_block_device[0].encrypted
    )
    error_message = "The contingency must use m6g.medium without T-family CPU credits and preserve the encrypted 20-GiB gp3 root volume."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.application_http.cidr_ipv4 == "0.0.0.0/0" &&
      aws_vpc_security_group_ingress_rule.application_http.from_port == 80 &&
      aws_vpc_security_group_ingress_rule.application_http.to_port == 80 &&
      aws_vpc_security_group_ingress_rule.application_https.cidr_ipv4 == "0.0.0.0/0" &&
      aws_vpc_security_group_ingress_rule.application_https.from_port == 443 &&
      aws_vpc_security_group_ingress_rule.application_https.to_port == 443
    )
    error_message = "Public application ingress must remain limited to TCP 80 and TCP 443."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.database_postgresql.cidr_ipv4 == null &&
      aws_vpc_security_group_ingress_rule.database_postgresql.from_port == 5432 &&
      aws_vpc_security_group_ingress_rule.database_postgresql.to_port == 5432
    )
    error_message = "PostgreSQL ingress must not use a CIDR and must remain restricted to port 5432."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.documents.restrict_public_buckets
    error_message = "The private documents bucket must block public policies."
  }

  assert {
    condition     = aws_iam_openid_connect_provider.github.client_id_list == toset(["sts.amazonaws.com"])
    error_message = "GitHub OIDC audience must be restricted to AWS STS."
  }
}
