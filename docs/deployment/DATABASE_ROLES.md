# Production database roles and rotation

The RDS-managed master account is reserved for database administration and the one-time role bootstrap. The application must not use it.

## Role model

- `sapienworx_migrator`: owns objects created by migrations and can create schema objects. Only the one-shot migration container receives this credential.
- `sapienworx_app`: runtime DML role with schema usage plus default table, sequence and function privileges granted by the migrator. Only the backend receives this credential.
- `sapienworx_intelligence`: restricted Intelligence Engine runtime role. It can process the `intelligence` schema and read only the public recruitment/operations tables required to derive approved features and platform signals. It cannot create schemas, tables, roles or databases.
- RDS master: stored in the RDS-managed Secrets Manager secret. EC2 and GitHub receive no permission to read it.

## Bootstrap after RDS creation

1. Retrieve the RDS master credential in an authorized administrative session without printing or committing it.
2. Generate three independent strong random passwords for the application, migration and Intelligence Engine roles.
3. Connect to the private RDS instance through an approved private administrative path, such as an SSM port-forwarding session to the application host.
4. Run `database/bootstrap/production_roles.sql` with `psql`, passing `database_name=sapienworx` as a psql variable and the three passwords through the short-lived `SAPIENWORX_APP_PASSWORD`, `SAPIENWORX_MIGRATION_PASSWORD` and `SAPIENWORX_INTELLIGENCE_PASSWORD` environment variables. The script installs the trusted `pgcrypto` and `pg_trgm` extensions while connected as the RDS administrator, before switching to the restricted migrator role. Do not place passwords on a shared command line or in shell history.
5. Build the TLS URLs and store the application URL in `/sapienworx/production/DATABASE_URL`, Intelligence Engine URL in `/sapienworx/production/INTELLIGENCE_DATABASE_URL`, and migration URL in `/sapienworx/production/MIGRATION_DATABASE_URL`.
6. Run the migration container. Because default privileges were configured before migrations, newly created application objects grant the runtime role only the required DML access.
7. Verify the backend can read/write normal application records and cannot create tables, roles or databases. Verify the Intelligence Engine role can process intelligence records and required source tables but cannot read unrelated private tables or create database objects.

## Rotation

RDS master rotation does not invalidate either runtime URL because the application and migrator are separate roles. To rotate an application or migration credential, schedule a maintenance window, generate a new password, update the PostgreSQL role and matching SSM SecureString as one controlled change, then redeploy/restart the affected container. Verify health before clearing the old administrative session.

Terraform state and plans contain only placeholder strings. GitHub never receives database credentials. The EC2 role reads only the required SSM hierarchy and has no Secrets Manager permission.
