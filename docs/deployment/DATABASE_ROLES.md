# Production database roles and rotation

The RDS-managed master account is reserved for database administration and the one-time role bootstrap. The application must not use it.

## Role model

- `sapienworx_migrator`: owns objects created by migrations and can create schema objects. Only the one-shot migration container receives this credential.
- `sapienworx_app`: runtime DML role with schema usage plus default table, sequence and function privileges granted by the migrator. Only the backend receives this credential.
- RDS master: stored in the RDS-managed Secrets Manager secret. EC2 and GitHub receive no permission to read it.

## Bootstrap after RDS creation

1. Retrieve the RDS master credential in an authorized administrative session without printing or committing it.
2. Generate two independent strong random passwords for the application and migration roles.
3. Connect to the private RDS instance through an approved private administrative path, such as an SSM port-forwarding session to the application host.
4. Run `database/bootstrap/production_roles.sql` with `psql`, passing `database_name=sapienworx` as a psql variable and the two passwords through the short-lived `SAPIENWORX_APP_PASSWORD` and `SAPIENWORX_MIGRATION_PASSWORD` environment variables. Do not place passwords on a shared command line or in shell history.
5. Build the TLS URLs and store the application URL in `/sapienworx/production/DATABASE_URL` and migration URL in `/sapienworx/production/MIGRATION_DATABASE_URL`.
6. Run the migration container. Because default privileges were configured before migrations, newly created application objects grant the runtime role only the required DML access.
7. Verify the backend can read/write normal application records and cannot create tables, roles or databases.

## Rotation

RDS master rotation does not invalidate either runtime URL because the application and migrator are separate roles. To rotate an application or migration credential, schedule a maintenance window, generate a new password, update the PostgreSQL role and matching SSM SecureString as one controlled change, then redeploy/restart the affected container. Verify health before clearing the old administrative session.

Terraform state and plans contain only placeholder strings. GitHub never receives database credentials. The EC2 role reads only the required SSM hierarchy and has no Secrets Manager permission.
