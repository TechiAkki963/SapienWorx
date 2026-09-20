# Production secret bootstrap

Use IAM Identity Center and AWS CLI profile `sapienworx_admin`. Do this only after the production Terraform apply has created RDS and the SSM parameter names.

## Values required

- `/sapienworx/production/DATABASE_URL`: application role URL using `sapienworx_app` and `sslmode=require`
- `/sapienworx/production/MIGRATION_DATABASE_URL`: separate migrator role URL using `sapienworx_migrator` and `sslmode=require`
- `/sapienworx/production/JWT_SECRET`: at least 32 cryptographically random bytes (48 random bytes encoded as Base64 is recommended)
- `/sapienworx/production/AUTH_OTP_HMAC_SECRET`: a different value with the same strength

RDS owns the master password in its AWS-managed Secrets Manager secret. Use it only for the documented database-role bootstrap. Do not construct the application URL from the master account. Follow `DATABASE_ROLES.md` and never paste credentials into source code, Terraform variables, tickets, chat, or shell history.

## Safe CLI procedure

1. Open a private administrative PowerShell or AWS CloudShell session and run `aws sso login --profile sapienworx_admin`.
2. Bootstrap the separate application and migration roles using `DATABASE_ROLES.md`.
3. Generate independent database-role, JWT and OTP values with the operating system cryptographic random-number generator. Compare paired values and stop if equal.
4. Build one temporary JSON request per parameter with `Type` set to `SecureString`, `Overwrite` set to `true`, and the value held only in the temporary file. Restrict the file to the current administrator.
5. Execute `aws ssm put-parameter --cli-input-json file://<temporary-file> --region ap-south-1 --profile sapienworx_admin`.
6. Immediately securely remove the temporary file and clear variables from the session. Do not print values to verify them.
7. Verify only metadata: `aws ssm describe-parameters --parameter-filters Key=Path,Option=Recursive,Values=/sapienworx/production --region ap-south-1 --profile sapienworx_admin`.
8. Run an SSM deployment. `deploy.sh` refuses placeholders, short/equal secrets, multiline values, and database URLs that do not require TLS.

AWS CLI command arguments can be visible to local process inspection and retained in shell history. That is why values should be passed through short-lived, access-restricted `--cli-input-json` files rather than inline `--value` arguments. Never share the output of a decrypted `get-parameter` or `get-secret-value` command.
