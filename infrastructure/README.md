# Infrastructure

Phase 7 will define the production AWS deployment with the explicit goal of keeping the initial monthly infrastructure footprint at or below USD 50 plus taxes where regional pricing and usage permit.

Allowed target services from the current product constraint:

- EC2 (`t3.micro` or `t4g.micro`, architecture compatibility permitting)
- RDS PostgreSQL (`db.t4g.micro` target)
- S3
- SNS for SMS

No infrastructure-as-code is added in Phase 1 because final deployment choices should follow application sizing and current AWS pricing verification in Phase 7.
