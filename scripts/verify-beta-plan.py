"""Verify a saved shared-host Terraform JSON plan before any apply."""
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
plan = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else root / "tmp/beta-plan.json").read_text(encoding="utf-8-sig"))
changes = plan["resource_changes"]
creates = [r for r in changes if "create" in r["change"]["actions"]]
for resource in changes:
    actions = resource["change"]["actions"]
    assert not {"update", "delete"}.intersection(actions), resource["address"]
    if "create" in actions:
        assert resource["address"].startswith("module.beta."), resource["address"]
        assert resource["type"] not in {"aws_instance", "aws_db_instance", "aws_db_subnet_group", "aws_db_parameter_group", "aws_security_group", "aws_vpc_security_group_ingress_rule", "aws_vpc_security_group_egress_rule", "aws_eip", "aws_eip_association", "aws_vpc", "aws_subnet", "aws_iam_instance_profile", "aws_internet_gateway", "aws_route_table"}, resource["address"]
assert plan["planned_values"]["outputs"]["ec2_instance_id"]["value"] == "i-0356b55e3d7eaf72a"
assert plan["planned_values"]["outputs"]["ec2_public_ip"]["value"] == "13.206.138.176"
message = f"PASS: {len(creates)} beta creates, zero updates/deletes; no new EC2/RDS/SG/EIP/VPC/subnet/profile; existing compute/database reused.\n"
(root / "docs/p3/evidence/beta-plan-summary.txt").write_text(message, encoding="utf-8")
print(message, end="")
