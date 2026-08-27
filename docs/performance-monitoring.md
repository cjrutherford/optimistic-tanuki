# Performance monitoring

All Angular browser entrypoints send privacy-safe, aggregated route measurements to
`POST /api/performance/rum`. Route parameters are normalized before transmission.
The gateway exposes owner-authorized summaries and alerts at:

- `GET /api/performance/summary`
- `GET /api/performance/alerts`
- `POST /api/performance/alerts/:id/acknowledge`

Prometheus scrapes `GET /api/performance/prometheus`. Grafana provisions the
Angular Performance dashboard from the observability Kustomization.

Each SSR Angular app also reports process runtime observations to the gateway
and, when `OTEL_EXPORTER_OTLP_ENDPOINT` is configured, to the OpenTelemetry
Collector. The protected `GET /api/performance/runtime` endpoint and the owner
console Runtime resources table show the latest CPU utilization, RSS memory,
GC pause duration, and GC event count for each app. These are process-level SSR
measurements, not browser-tab CPU or memory estimates.

## Resource comparison

Run the same route and workload against each deployment profile:

```bash
node scripts/performance-load.mjs --url http://127.0.0.1:8080 --path / --duration 60 --concurrency 20
```

Record p50/p75/p95, errors, pod CPU throttling, memory working set, restarts,
and gateway latency for the current profile, CPU-only increase, memory-only
increase, and combined increase. Do not change Kubernetes limits until the
comparison shows resource saturation correlating with the user-facing metric.

The initial owner alert thresholds are p75 LCP 2500ms, INP 200ms, CLS 0.1,
TTFB 800ms, route transition 2000ms, and hydration 2000ms. Alerts require two
consecutive five-minute windows with at least 20 samples.
