resource "aws_security_group" "database" {
  name                   = "${local.name_prefix}-database"
  description            = "Private beta PostgreSQL from the approved shared application host"
  vpc_id                 = var.shared_vpc_id
  revoke_rules_on_delete = true
  tags                   = { Name = "${local.name_prefix}-database" }
}
resource "aws_vpc_security_group_ingress_rule" "database_postgresql" {
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = var.shared_application_security_group_id
  description                  = "Beta PostgreSQL from the shared host security group"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
# Add a beta-only egress rule without owning/replacing the production SG.
resource "aws_vpc_security_group_egress_rule" "shared_to_beta_database" {
  security_group_id            = var.shared_application_security_group_id
  referenced_security_group_id = aws_security_group.database.id
  description                  = "Shared host to private beta RDS only"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
