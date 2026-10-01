# Locality snapshot for behaviour tests

A frozen copy of `localities/` as of commit 7a51f50 (2026-09-21), before the
beta disabled Google News discovery and stopped publishing Adel.

Tests of projection, storage and restricted-source handling use Adel and the
county-owned discovery sources as realistic examples. They exercise pipeline
behaviour, not the beta's editorial choices, so they read this copy and do
not change when `localities/` does. Tests about the production graph itself
read `localities/`.
