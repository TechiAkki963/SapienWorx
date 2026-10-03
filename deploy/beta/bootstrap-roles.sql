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

\if :{?intelligence_password}
\else
  \getenv intelligence_password SAPIENWORX_INTELLIGENCE_PASSWORD
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

\if :{?intelligence_password}
\else
  \echo 'intelligence_password or SAPIENWORX_INTELLIGENCE_PASSWORD is required'
  \quit
\endif

-- Run only after creating the empty beta database, never against production.
SELECT current_database() = 'sapienworx_beta' AND :'database_name' = 'sapienworx_beta' AS correct_beta_target \gset
\if :correct_beta_target
\else
  \echo 'Refusing non-beta database bootstrap'
  SELECT 1/0;
\endif

-- These trusted extensions require database-level CREATE and are therefore
-- installed once by the controlled RDS administrator, never by the runtime
-- application role. Later migrations keep IF NOT EXISTS for local setups.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SELECT format(
  'CREATE ROLE sapienworx_beta_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  :'migration_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sapienworx_beta_migrator')
\gexec

SELECT format(
  'CREATE ROLE sapienworx_beta_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sapienworx_beta_app')
\gexec

SELECT format(
  'CREATE ROLE sapienworx_beta_intelligence LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  :'intelligence_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sapienworx_beta_intelligence')
\gexec

ALTER ROLE sapienworx_beta_migrator PASSWORD :'migration_password';
ALTER ROLE sapienworx_beta_app PASSWORD :'app_password';
ALTER ROLE sapienworx_beta_intelligence PASSWORD :'intelligence_password';

GRANT CONNECT ON DATABASE :"database_name" TO sapienworx_beta_migrator, sapienworx_beta_app, sapienworx_beta_intelligence;
-- Forward migrations create workforce/intelligence schemas in beta only.
GRANT CREATE ON DATABASE :"database_name" TO sapienworx_beta_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO sapienworx_beta_migrator;
GRANT USAGE ON SCHEMA public TO sapienworx_beta_app;

GRANT sapienworx_beta_migrator TO CURRENT_USER;
SET ROLE sapienworx_beta_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sapienworx_beta_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sapienworx_beta_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO sapienworx_beta_app;
RESET ROLE;
REVOKE sapienworx_beta_migrator FROM CURRENT_USER;

ALTER ROLE sapienworx_beta_migrator IN DATABASE :"database_name" SET search_path = public;
ALTER ROLE sapienworx_beta_app IN DATABASE :"database_name" SET search_path = public,intelligence;
ALTER ROLE sapienworx_beta_intelligence IN DATABASE :"database_name" SET search_path = intelligence,public;

REVOKE CONNECT, TEMPORARY ON DATABASE sapienworx_beta FROM PUBLIC;
