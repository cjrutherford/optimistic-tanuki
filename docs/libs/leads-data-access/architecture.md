# leads-data-access Architecture

`leads-data-access` is the thin client layer for base lead CRUD and stats queries.

## Main Responsibilities

- wrap `/api/leads` HTTP calls
- expose typed CRUD methods for lead records
- expose lead stats retrieval

## Consumers

- `leads-app`

This library should remain small and focused on foundational lead-record access rather than workflow orchestration.
