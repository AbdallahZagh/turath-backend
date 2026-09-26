-- Runs once, on the first start of an empty Postgres volume.
-- One database per microservice. Add a line here when a new service gets a database.
CREATE DATABASE turath_identity;

\connect turath_identity
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Catalog / booking will need PostGIS for geo search (ST_DWithin) and clustering:
-- CREATE DATABASE turath_catalog;
-- \connect turath_catalog
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS unaccent;
