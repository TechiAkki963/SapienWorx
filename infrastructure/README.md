# SapienWorx production infrastructure

The production AWS design is declared under `terraform/` and intentionally split into two states:

- `bootstrap/` creates only the private, versioned state bucket using local state.
- `production/` creates the reviewed production VPC, compute, database, storage, image registries, least-privilege identities, monitoring, and runtime placeholders.

No Terraform command in this repository should target the AWS default VPC. The design has no NAT Gateway, load balancer, Kubernetes cluster, cache, Multi-AZ database, or WAF in order to stay near the approved initial budget.

Read both Terraform READMEs and `docs/deployment/` before provisioning. Planning is safe; applying requires explicit product-owner approval.
