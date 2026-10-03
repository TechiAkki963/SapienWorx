data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_instance" "shared" {
  instance_id = var.shared_instance_id
  lifecycle {
    postcondition {
      condition     = self.subnet_id == var.shared_application_subnet_id && contains(self.vpc_security_group_ids, var.shared_application_security_group_id)
      error_message = "Existing EC2 must match the reviewed VPC and security group."
    }
    postcondition {
      condition     = one(self.metadata_options).http_tokens == "required" && one(self.root_block_device).encrypted
      error_message = "Shared EC2 must retain IMDSv2 and encrypted root storage."
    }
  }
}
data "aws_subnet" "shared_application" {
  id = var.shared_application_subnet_id
  lifecycle {
    postcondition {
      condition     = self.vpc_id == var.shared_vpc_id
      error_message = "Shared application subnet must belong to the reviewed VPC."
    }
  }
}
data "aws_iam_role" "shared" {
  name = var.shared_instance_role_name
}
data "aws_subnet" "shared_private" {
  for_each = toset(var.shared_private_subnet_ids)
  id       = each.value
  lifecycle {
    postcondition {
      condition     = self.vpc_id == var.shared_vpc_id && !self.map_public_ip_on_launch
      error_message = "Beta RDS must use the reviewed private subnets in the existing VPC."
    }
  }
}
