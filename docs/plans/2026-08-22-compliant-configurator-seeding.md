# Compliant Configurator Seeding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make app-configurator demo seeding an explicit, owner-attested operator action rather than a dedicated Compose/Kubernetes lifecycle service.

**Architecture:** Keep the existing owner-scoped, idempotent seed script and the standard `scripts/run-seed.sh` entry point. Remove the automatic `app-configurator-seed` services and every readiness/lifecycle dependency on them from production, development, Kubernetes-compatibility, and E2E compositions.

**Tech Stack:** Docker Compose, shell orchestration, Node test runner, Nx.

---

### Task 1: Prove E2E lifecycle no longer needs an automatic configurator seed

**Files:**

- Modify: `scripts/tests/e2e-environment-manifest.test.mjs`
- Modify: `scripts/e2e-environment-manifest.mjs`
- Modify: `scripts/validate-e2e-environment.mjs`

1. Change target expectations so app-configurator is a normal service and only database/permissions seed jobs can be lifecycle completions.
2. Run the test and observe it fail against the existing special seed phase.
3. Remove the app-configurator seed phase, dependency, and ordering validation.
4. Rerun the test.

### Task 2: Remove the dedicated deployment services

**Files:**

- Modify: `docker-compose.yaml`
- Modify: `docker-compose.dev.yaml`
- Modify: `docker-compose.k8s.yaml`
- Modify: `e2e/docker-compose.e2e-stack.yaml`
- Modify: `e2e/docker-compose.app-configurator-e2e.yaml`
- Modify: `e2e/docker-compose.configurable-client-e2e.yaml`
- Modify: `scripts/docker-start-phased.sh`
- Modify: `scripts/validate-compose-k8s-parity.sh`
- Modify: `scripts/validate-docker-bootstrap.mjs`

1. Remove service declarations and `depends_on` entries for `app-configurator-seed`.
2. Remove the phased start seed job and obsolete parity exception.
3. Assert deployment validation no longer recognizes that service.
4. Run the bootstrap/parity validation.

### Task 3: Update readiness and tracking evidence

**Files:**

- Modify: `scripts/tests/wait-for-e2e-readiness.test.mjs`
- Modify: `apps/client-interface-e2e/e2e-lifecycle.ts`
- Modify: `docs/reports/configurable-platform-program/index.html`

1. Replace the completed-seed readiness fixture with normal app-configurator readiness.
2. Remove the obsolete build exclusion.
3. Mark Slice 24 complete with explicit operator-run seed evidence.
4. Run focused Node validation, Docker Compose configuration rendering, relevant Nx tests/builds, and whitespace checks.
