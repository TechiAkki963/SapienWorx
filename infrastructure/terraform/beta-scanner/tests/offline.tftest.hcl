mock_provider "aws" {}
run "private_paused_scanner" {
  command = plan
  variables {
    scanner_image = "327301848391.dkr.ecr.ap-south-1.amazonaws.com/sapienworx-beta/scanner@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
  override_data {
    target = data.aws_instance.beta_host
    values = { private_ip = "10.42.2.10" }
  }
  assert {
    condition     = aws_ecs_service.scanner.desired_count == 0 && !aws_ecs_service.scanner.network_configuration[0].assign_public_ip
    error_message = "Review stack must remain paused and private."
  }
  assert {
    condition     = aws_ecs_task_definition.scanner.memory == "4096" && aws_ecs_task_definition.scanner.cpu == "1024"
    error_message = "Do not undersize scanner memory."
  }
  assert {
    condition     = length(aws_vpc_endpoint.interface) == 3 && aws_vpc_endpoint.s3.vpc_endpoint_type == "Gateway"
    error_message = "Private image/log/signature paths are required."
  }
  assert {
    condition     = aws_service_discovery_private_dns_namespace.scanner.name == "beta-scanner.sapienworx.internal"
    error_message = "Scanner discovery must remain private and beta-specific."
  }
}
