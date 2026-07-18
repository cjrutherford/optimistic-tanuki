# Slice 20 Observe-Only Locality Trust Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Record and assess locality telemetry for live playback without changing
playback authorization.

**Architecture:** A small `locality` TCP service owns observation persistence and
a pure assessor for timestamp, GPS-quality, and impossible-travel signals.
Videos submits an opaque viewer session and coordinates during live-token issue
and validation, embeds the result in the existing signed capability, and keeps
the current radius decision independent. Gateway only forwards the contract.

**Tech Stack:** NestJS microservices, TypeORM/PostgreSQL migrations, Angular,
Jest, Playwright, Nx, Docker Compose.

---

### Task 1: Locality telemetry service

**Files:**

- Create: `apps/locality/**`
- Create: `apps/locality/migrations/*-locality-observation.ts`
- Modify: `libs/constants/src/lib/libs/service.tokens.ts`
- Modify: `libs/constants/src/lib/libs/locality.ts`
- Modify: `libs/models/src/lib/libs/locality-trust.dto.ts`
- Modify: Docker Compose and `db-setup` migration registration

1. Write failing assessor/service tests for valid observations, stale timestamps,
   poor accuracy, and impossible travel.
2. Run the locality test target and confirm the tests fail for missing behavior.
3. Add the smallest persistence model and pure assessor that returns an
   `unverified`, `observed`, or `suspicious` assessment with reasons and score.
4. Register the normal TypeORM migration and TCP command; do not repair schema
   in seeds.
5. Run the locality unit tests and build.

### Task 2: Observe-only live-token integration

**Files:**

- Modify: `apps/videos/src/app/services/broadcast.service.ts`
- Modify: `apps/videos/src/app/app.module.ts`
- Modify: `apps/videos/src/app/app.controller.ts`
- Modify: `apps/gateway/src/controllers/videos/videos.controller.ts`
- Modify: matching contracts and focused tests

1. Write failing tests that prove a suspicious assessment is included in issue
   and validation responses while a valid in-radius viewer is still accepted.
2. Wire the locality TCP client and forward the opaque browser session,
   coordinates, accuracy, and observed timestamp.
3. Add the assessment to signed claims and returned DTOs; never use it as a
   denial condition in this slice.
4. Run focused Videos and Gateway tests and builds.

### Task 3: Browser contract and documentation

**Files:**

- Modify: `apps/video-client/src/app/pages/live-playback/**`
- Modify: `apps/video-client/src/app/services/video.service.ts`
- Modify: `apps/video-client-e2e/src/live-playback.spec.ts`
- Modify: `docs/guides/metrocast-locality-evaluator-guide.md`
- Modify: `docs/plans/2026-06-29-metrocast-slice-tracker.md`

1. Write failing client tests for a stable opaque browser session and optional
   GPS accuracy/timestamp payload.
2. Forward telemetry to both requests and render an informational, non-blocking
   suspicious-locality state.
3. Update the evaluator guide and mark Slice 20.1 completed with the explicit
   observe-only policy.
4. Run affected Nx tests/builds, focused Chromium E2E, `slice:checkpoint:dev`,
   and `git diff --check`.
