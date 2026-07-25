# Owner Console Security Observability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a protected, aggregated security-metrics API and visual trend dashboard to the Owner Console.

**Architecture:** The gateway queries Loki server-side and reduces edge events into fixed time buckets, headline totals, and ranked dimensions. The Owner Console consumes that restricted API alongside the existing masked-event endpoint and renders compact trend charts using the workspace chart library.

**Tech Stack:** NestJS, Angular standalone components, RxJS, Chart.js/ng2-charts, Jest, Loki LogQL.

---

### Task 1: Define and test the gateway metrics contract

**Files:**

- Modify: `apps/gateway/src/security/security-telemetry.service.spec.ts`
- Modify: `apps/gateway/src/security/security-telemetry.service.ts`
- Modify: `apps/gateway/src/security/security-telemetry.controller.spec.ts`
- Modify: `apps/gateway/src/security/security-telemetry.controller.ts`

**Step 1:** Write failing service/controller tests for a bucketed metrics response, including classification and host filters.

**Step 2:** Run the gateway test target to verify the new tests fail because the metrics API is absent.

**Step 3:** Implement the minimal server-side Loki query/reduction, bounded time range/bucket/limit validation, and `GET /api/security/metrics` permission guard.

**Step 4:** Run the focused gateway tests to verify the contract passes.

### Task 2: Add Owner Console graph data handling and controls

**Files:**

- Modify: `apps/owner-console/src/app/services/security-observability.service.ts`
- Modify: `apps/owner-console/src/app/services/security-observability.service.spec.ts`
- Modify: `apps/owner-console/src/app/components/security-observability.component.spec.ts`
- Modify: `apps/owner-console/src/app/components/security-observability.component.ts`

**Step 1:** Write failing tests for loading a default 60-minute window and rendering metrics trends.

**Step 2:** Run the Owner Console test target to verify the tests fail.

**Step 3:** Add the metrics client, a time-range control, accessible charts for request/security activity and latency/error posture, and filtered event refreshes.

**Step 4:** Run the focused tests, then the full Owner Console target.

### Task 3: Harden and validate the observability deployment

**Files:**

- Modify: `k8s/base/observability/otel-collector.yaml`
- Modify: `k8s/base/observability/prometheus.yaml`
- Modify: `k8s/base/observability/grafana.yaml`
- Modify: `docs/operators/observability-setup.md`

**Step 1:** Add alert rules for collector ingestion/export failure and sharp denied/error rates where the collected data supports it.

**Step 2:** Add a metrics dashboard panel that makes the Owner Console metrics source and alert thresholds operationally visible.

**Step 3:** Validate the rendered Kustomize output and JSON dashboard syntax.

### Task 4: Verify the affected surfaces

**Files:**

- Test: gateway security telemetry specs
- Test: Owner Console test target
- Test: Kustomize render

**Step 1:** Run the smallest changed test slices.

**Step 2:** Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test gateway` and the equivalent Owner Console target.

**Step 3:** Render observability manifests and inspect the working-tree diff.
