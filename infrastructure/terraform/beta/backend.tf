terraform {
  backend "s3" {
    key          = "sapienworx/beta/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}
