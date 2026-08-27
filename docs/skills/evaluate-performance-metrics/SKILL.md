---
name: evaluate-performance-metrics
description: Use when Angular routes feel slow, unresponsive, or inconsistent; when comparing Client, Server, and Prerender rendering; when deciding whether CPU or memory changes are justified; or when reviewing owner-console performance alerts.
---

# Evaluate Performance Metrics

Use this project-local skill to produce an evidence-based performance assessment. Treat route rendering, browser UX, backend latency, and container resources as separate signals that must be correlated before assigning cause.

## Evidence sources

- `docs/performance-monitoring.md` — thresholds, endpoints, and the load-test baseline.
- `apps/*/src/app/app.routes.server.ts` — declared Angular `RenderMode` by route.
- `GET /api/performance/summary` — owner-authorized p50/p75/p95 aggregates.
- `GET /api/performance/alerts` — active and recovered owner alerts.
- `GET /api/performance/prometheus` — scrapeable metrics for infrastructure correlation.
- `scripts/performance-load.mjs` — repeatable route/load comparison.

## Workflow

1. **Define the cohort.** Record app, exact route, viewport/device class, build version, deployment profile, test duration, concurrency, and timestamp. Do not combine public, authenticated, mobile, and desktop traffic into one conclusion.

2. **Map the route mode.** Read the app’s `app.routes.server.ts` and classify the route as `Client`, `Server`, or `Prerender`. Match normalized telemetry routes to route patterns. If the telemetry says `Unknown`, report the limitation and use the route configuration only as a declared-mode comparison; do not claim that telemetry proves a mode caused the regression.

3. **Collect application evidence.** Query the owner endpoints and capture the response for the same time window. Evaluate LCP, INP, CLS, TTFB, route transition, hydration, and long-task p75/p95, plus sample counts and error rates. Two consecutive five-minute windows with at least 20 samples are required before treating a threshold breach as sustained.

4. **Separate the likely cause.** Use this decision rule:

   - high TTFB with normal browser long tasks → server, gateway, or network path;
   - normal TTFB with high LCP/hydration/long tasks → bundle, hydration, or client main-thread work;
   - high INP/long tasks during navigation → client rendering or event-handler contention;
   - degraded UX only under high concurrency with CPU throttling or memory pressure → resource saturation;
   - mode cohorts with different metrics but no matching resource signal → investigate route data, bundle size, or behavior before resizing.

5. **Compare resources safely.** Run the same workload against current, CPU-only, memory-only, and combined profiles. Keep route, build, duration, concurrency, and warm-up behavior constant:

   ```bash
   node scripts/performance-load.mjs --url http://127.0.0.1:8080 --path / --duration 60 --concurrency 20
   ```

   Record p50/p75/p95 latency, errors, CPU throttling, memory working set, restarts, and gateway latency. Recommend more CPU or memory only when resource saturation coincides with UX degradation and the controlled comparison improves the affected metric. Label any recommendation as unproven when resource telemetry is missing.

6. **Review alerting.** Check owner-console alerts, severity, first/last occurrence, affected app/route, and acknowledgement state. Acknowledge only after an owner has a mitigation or tracking issue. Confirm recovery rather than treating acknowledgement as resolution. The current gateway aggregation is process-local; flag multi-replica deployments as requiring shared alert state before relying on alert completeness.

7. **Report the conclusion.** Include the cohort, render-mode map, metric table, resource table, alert state, causal confidence (`confirmed`, `likely`, or `insufficient evidence`), and the smallest next action. Never hide missing samples, failed probes, or a non-running target stack.

## Verification commands

Use the repository’s package manager and deterministic Nx environment for workspace checks:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run gateway:build:development --skip-nx-cache --outputStyle=stream
pnpm exec nx lint gateway
pnpm exec nx lint owner-console
```

For a live stack, verify the target app is reachable before loading it. Prefer the checked-in Nx e2e target for browser validation, and use `SKIP_SETUP=true` only when the shared stack is already running. Do not restart or tear down shared services during an observational run.

## Guardrails

- Do not infer causality from a single percentile, route, device, or alert.
- Do not change Kubernetes requests/limits, rendering modes, or alert thresholds as part of an evaluation without explicit implementation scope.
- Do not expose owner cookies, tokens, emails, or raw user identifiers in reports.
- If the target stack or required telemetry is unavailable, stop at an evidence gap and state exactly what must be collected next.
