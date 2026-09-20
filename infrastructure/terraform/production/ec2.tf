locals {
  cloudwatch_agent_config = jsonencode({
    agent = {
      metrics_collection_interval = 60
      run_as_user                 = "root"
    }
    metrics = {
      namespace = "SapienWorx/Host"
      append_dimensions = {
        InstanceId = "$${aws:InstanceId}"
      }
      metrics_collected = {
        mem = {
          measurement                 = ["mem_used_percent"]
          metrics_collection_interval = 60
        }
        disk = {
          measurement                 = ["used_percent"]
          metrics_collection_interval = 60
          resources                   = ["/"]
          drop_device                 = true
        }
      }
    }
    logs = {
      logs_collected = {
        files = {
          collect_list = [
            {
              file_path       = "/var/log/cloud-init-output.log"
              log_group_name  = aws_cloudwatch_log_group.host.name
              log_stream_name = "{instance_id}/cloud-init"
            },
            {
              file_path       = "/var/log/sapienworx-bootstrap.log"
              log_group_name  = aws_cloudwatch_log_group.host.name
              log_stream_name = "{instance_id}/bootstrap"
            },
            {
              file_path       = "/var/lib/docker/containers/*/*.log"
              log_group_name  = aws_cloudwatch_log_group.application.name
              log_stream_name = "{instance_id}/containers"
            },
          ]
        }
      }
    }
  })
}

resource "aws_instance" "application" {
  ami           = data.aws_ssm_parameter.al2023_arm64_ami.value
  instance_type = var.ec2_instance_type
  subnet_id     = aws_subnet.public_ap_south_1c.id

  vpc_security_group_ids = [aws_security_group.application.id]
  iam_instance_profile   = aws_iam_instance_profile.application.name

  associate_public_ip_address = false
  source_dest_check           = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
    instance_metadata_tags      = "disabled"
  }

  dynamic "credit_specification" {
    for_each = startswith(var.ec2_instance_type, "t4g.") ? [1] : []

    content {
      cpu_credits = "standard"
    }
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.ec2_root_volume_size
    encrypted             = true
    delete_on_termination = true
  }

  user_data_base64 = base64gzip(templatefile("${path.module}/templates/user-data.sh.tftpl", {
    docker_compose_version = var.docker_compose_version
    compose_file_b64       = filebase64("${path.root}/../../../deploy/production/compose.production.yml")
    caddyfile_b64          = filebase64("${path.root}/../../../deploy/production/Caddyfile")
    deploy_script_b64      = filebase64("${path.root}/../../../deploy/production/deploy.sh")
    rollback_script_b64    = filebase64("${path.root}/../../../deploy/production/rollback.sh")
    health_script_b64      = filebase64("${path.root}/../../../deploy/production/health-check.sh")
    cloudwatch_config_b64  = base64encode(local.cloudwatch_agent_config)
  }))
  user_data_replace_on_change = true

  monitoring = false

  lifecycle {
    # The reserved Elastic IP is managed by aws_eip_association.application.
    # After that association, EC2 can report the instance as having a public IP
    # even though automatic public-address assignment remains disabled. Ignoring
    # this computed readback prevents an unnecessary instance replacement.
    #
    # Bootstrap corrections for the live host are applied through SSM. The
    # current template is still used whenever Terraform creates a future host,
    # but changing the template must not replace a healthy production instance.
    ignore_changes = [
      associate_public_ip_address,
      user_data_base64,
    ]

    precondition {
      condition     = contains(["t4g.medium", "m6g.medium"], var.ec2_instance_type)
      error_message = "The approved ARM64 configuration supports only t4g.medium or m6g.medium."
    }
  }

  tags = { Name = "${local.name_prefix}-application" }
}

resource "aws_eip" "application" {
  domain = "vpc"

  tags = { Name = "${local.name_prefix}-application" }
}

resource "aws_eip_association" "application" {
  allocation_id = aws_eip.application.id
  instance_id   = aws_instance.application.id
}
