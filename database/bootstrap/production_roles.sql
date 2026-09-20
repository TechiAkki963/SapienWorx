\set ON_ERROR_STOP on

\if :{?database_name}
\else
  \echo 'database_name is required'
  \quit
\endif

\if :{?app_password}
\else
  \getenv app_password SAPIENWORX_APP_PASSWORD
\endif

\if :{?migration_password}
\else
  \getenv migration_password SAPIENWORX_MIGRATION_PASSWORD
\endif

\if :{?app_password}
\else
  \echo 'app_password or SAPIENWORX_APP_PASSWORD is required'
  \quit
\endif

\if :{?migration_password}
\else
  \echo 'migration_password or SAPIENWORX_MIGRATION_PASSWORD is required'
  \quit
\endif

-- These trusted extensions require database-level CREATE and are therefore
-- installed once by the controlled RDS administrator, never by the runtime
-- application role. Later migrations keep IF NOT EXISTS for local setups.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SELECT format(
  'CREATE ROLE sapienworx_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  :'migration_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sapienworx_migrator')
\gexec

SELECT format(
  'CREATE ROLE sapienworx_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sapienworx_app')
\gexec

ALTER ROLE sapienworx_migrator PASSWORD :'migration_password';
ALTER ROLE sapienworx_app PASSWORD :'app_password';

GRANT CONNECT ON DATABASE :"database_name" TO sapienworx_migrator, sapienworx_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO sapienworx_migrator;
GRANT USAGE ON SCHEMA public TO sapienworx_app;

GRANT sapienworx_migrator TO CURRENT_USER;
SET ROLE sapienworx_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sapienworx_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sapienworx_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO sapienworx_app;
RESET ROLE;
REVOKE sapienworx_migrator FROM CURRENT_USER;

ALTER ROLE sapienworx_migrator IN DATABASE :"database_name" SET search_path = public;
ALTER ROLE sapienworx_app IN DATABASE :"database_name" SET search_path = public;
