-- Execute using psql as postgres with variables :runtime_pass :identity_pass :operator_pass.
-- This script is dev/test only; no real credentials embedded.
SELECT format('CREATE ROLE app_runtime LOGIN PASSWORD %L NOINHERIT NOBYPASSRLS', :'runtime_pass')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_runtime') \gexec
SELECT format('CREATE ROLE identity_reader LOGIN PASSWORD %L NOINHERIT NOBYPASSRLS', :'identity_pass')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='identity_reader') \gexec
SELECT format('CREATE ROLE platform_operator LOGIN PASSWORD %L NOINHERIT NOBYPASSRLS', :'operator_pass')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='platform_operator') \gexec
