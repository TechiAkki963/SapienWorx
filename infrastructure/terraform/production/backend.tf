terraform {
  backend "s3" {
    key          = "sapienworx/production/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}
