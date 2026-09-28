# Civic agenda source polling

Civic polls configured municipal agenda indexes on startup and every six hours by default. Change the interval with `CIVIC_AGENDA_POLL_INTERVAL_MS`. The default sources are the [City of Savannah agenda index](https://agenda.savannahga.gov/publishing/ap-agendas.html) and [MPC Planning Commission meetings](https://www.thempc.org/Board/Tpc). The importer reads dated index rows whose link is labeled **Agenda**, follows each URL, and processes the five newest agenda rows on each index per poll.

The indexes have different formats. Savannah links to Agenda Plus `agenda.html` detail pages containing the complete agenda text and separate item attachments; Civic extracts numbered items from that HTML page. It does not mistake those HTML pages or their supporting PDFs for a single agenda PDF. MPC links directly to agenda PDFs; Civic extracts text from those PDFs. Fixture tests cover both formats and repeat polling.

Every source needs a tenant ID before Civic polls it. Set `CIVIC_TENANT_ID` to a tenant explicitly chosen by the operator, or provide a per-source `tenantId` in `CIVIC_AGENDA_SOURCES`. Civic has no default tenant. Sources without a tenant ID are skipped without making a network request. The environment variable replaces the YAML source list and accepts JSON, for example:

```json
[
  {
    "id": "savannah-city-council",
    "indexUrl": "https://agenda.savannahga.gov/publishing/ap-agendas.html",
    "meetingBody": "city-council",
    "tenantId": "operator-configured-tenant"
  },
  {
    "id": "mpc-planning-commission",
    "indexUrl": "https://www.thempc.org/Board/Tpc",
    "meetingBody": "planning-commission",
    "tenantId": "operator-configured-tenant"
  }
]
```

For direct PDF imports, `CIVIC_AGENDA_SOURCES` can instead contain entries with `url` and `id`. The permission-gated `POST /api/v1/civic/agendas/import-source` endpoint accepts the configured `sourceId`, `meetingBody`, `meetingDate`, and `title`. Polling and direct imports deduplicate by source meeting identity and SHA-256 document content. When a mutable source changes its PDF or agenda HTML, Civic refreshes the existing meeting record and replaces its line items. PostgreSQL advisory transaction locks serialize concurrent updates to the same source meeting within a tenant.

Manual PDF upload at `POST /api/v1/civic/agendas/ingest` remains a separate staff workflow and is not a scraper.
