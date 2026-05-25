# System Configurator API Architecture

`system-configurator-api` is a Nest TCP microservice for hardware catalog lookup, compatibility checks, pricing, saved configurations, and order creation.

## Main Responsibilities

- provide chassis and component catalog access
- compute or expose compatibility information
- calculate or return pricing data
- create and retrieve orders
- save and load user configurations
- keep external catalog data in sync when configured to do so

## Runtime Model

- Nest TCP microservice
- Postgres-backed service with migration-backed schema
- startup sequence includes catalog seeding and optional external sync
- Dockerized build and deploy model

## Operational Risk Areas

- scraper and sync fragility against external PCPartPicker markup
- startup-time sync side effects
- catalog correctness after seeding or failed syncs
