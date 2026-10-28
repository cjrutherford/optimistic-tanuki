# OT/TS OpenTelemetry and Grafana setup

## Current state

On 2026-10-25 the operator confirmed that OT (`client-interface`) and TS
(`local-hub`) have no configured forwarded log capture destinations. Collector
manifests in this repository are setup material, not evidence of a deployed or
connected collector. This change installs nothing and enables no forwarding.

On 2026-10-26 the operator also confirmed no retained legacy OT/TS logs,
including manual copies outside Docker. This does not authorize retaining new
identifiable copies without a cleanup/readback contract.

Local stdout/stderr, browser consoles and any historical container files are
separate sinks. The absence of a forwarding destination is not an account-purge
receipt for those sinks. D25 must record the actual local topology and verify
its controllable copies before the account/key finalizer can run.

## Prepare the pipeline

Use the existing [observability runbook](./observability-setup.md) for cluster
prerequisites, generated credentials, installation and dashboard access. Its
CrowdSec instructions apply to edge-security integration; they are not a new
OT/TS application release requirement.

The checked-in resources are under `k8s/base/observability`:

| Component               | Checked-in service    | Purpose                                        |
| ----------------------- | --------------------- | ---------------------------------------------- |
| OpenTelemetry Collector | `otel-collector`      | OTLP ingestion on 4317/4318 and metrics export |
| Loki                    | `loki`                | Log storage                                    |
| Prometheus              | `security-prometheus` | Metrics storage                                |
| Grafana                 | `grafana`             | Dashboards using the provisioned data sources  |

Before enabling a destination, review the collector's receiver and processor
configuration. The current ingress-file/syslog pipeline classifies events; it
is not a general redaction or account-deletion adapter. Scope inputs to the two
applications and their required shared services. Do not enable unrelated
application or host-log collection as a side effect.

Keep application diagnostics on the shared payload-free boundary. Send event
names, service names, route templates, status classes and aggregate timings.
Exclude account/profile IDs, tokens, cookies, authorization headers, request or
response bodies, query strings and freeform private content. Apply the same
rule to metric labels, resource attributes and tracing baggage. A dashboard
query or collector classification does not sanitize the original stored event.

## Connect and verify

1. Generate the deployment credentials through the existing runbook. Keep them
   out of source control and terminal output.
2. Review the rendered manifests, then deploy the intended observability
   resources using that runbook. Confirm the actual Service names and namespace
   before setting application endpoints.
3. The two SSR servers already read `OTEL_EXPORTER_OTLP_ENDPOINT`. Their shared
   Node performance monitor appends `/v1/metrics`, so configure the collector's
   OTLP HTTP base URL, not a URL already ending in `/v1/metrics`.
4. Emit a synthetic allowed diagnostic and a small metrics workload from each
   scoped app. Verify arrival, resource attribution and dashboard queries.
   Independently verify that synthetic identifier/content sentinels are absent
   from the stored payload and labels, not just hidden in the dashboard.
5. Record the collector replicas, storage/volumes, endpoints, retention,
   credentials owner and downstream copies in the N04/D25 inventory. State how
   an account-safe purge and independent readback work if identifying fields
   are ever introduced. Do not mark an unsupported sink verified.
6. Test a collector outage and application restart. Applications must preserve
   their diagnostic boundary and must not fall back to printing private
   payloads. Record whether the exporter drops, buffers or retries data.

Grafana access controls, persisted Loki/Prometheus volumes, collector queues,
backups and any forwarding added later become part of that operator inventory.
Retention is not a replacement for the approved account-erasure contract.
No live collector, dashboard, forwarding or purge qualification is claimed by
this setup document.
