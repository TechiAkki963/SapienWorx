data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_ssm_parameter" "al2023_arm64_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}
