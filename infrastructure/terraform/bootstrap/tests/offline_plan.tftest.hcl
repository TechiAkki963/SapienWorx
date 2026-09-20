mock_provider "aws" {}

run "state_bucket_plan" {
  command = plan

  override_data {
    target = data.aws_caller_identity.current
    values = {
      account_id = "123456789012"
      arn        = "arn:aws:iam::123456789012:user/offline-plan"
      id         = "123456789012"
    }
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.terraform_state.block_public_policy
    error_message = "Terraform state must block public bucket policies."
  }

  assert {
    condition     = aws_s3_bucket_versioning.terraform_state.versioning_configuration[0].status == "Enabled"
    error_message = "Terraform state versioning must remain enabled."
  }
}
