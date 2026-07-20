# Video Processing Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give platform owners a safe Operations workspace for monitoring video transcoding and retrying failed jobs without overwhelming the transcoder.

**Architecture:** The videos service owns a bounded in-memory processing queue and exposes an owner-authorized processing overview plus single and bulk retry commands through the gateway. The owner console consumes those APIs in a dedicated Operations route with auto-refresh, status totals, per-video retry, and a confirmed retry-all action.

**Tech Stack:** NestJS, TypeORM, TCP microservice commands, Angular standalone components, RxJS, Jest, Nx.

---

### Task 1: Add bounded video-processing queue behavior

**Files:**

- Modify: `apps/videos/src/app/services/video-processing.service.ts`
- Modify: `apps/videos/src/app/services/video.service.ts`
- Test: `apps/videos/src/app/services/video-processing.service.spec.ts`
- Test: `apps/videos/src/app/services/video.service.spec.ts`

**Step 1:** Write failing tests proving queued jobs execute no more than two at a time and a failed video can be requeued.

**Step 2:** Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test videos --runInBand` and confirm failure.

**Step 3:** Add `enqueue(videoId)` to `VideoProcessingService`; retain `processVideo` as the worker operation. Change creation and retry paths to enqueue rather than start unbounded work.

**Step 4:** Add `retryProcessing(id)` and `getProcessingOverview()` to `VideoService`; return status totals, recent jobs, and failed IDs only.

**Step 5:** Re-run the videos suite and confirm it passes.

### Task 2: Expose owner-authorized processing APIs

**Files:**

- Modify: `libs/constants/src/lib/libs/videos.ts`
- Modify: `apps/videos/src/app/app.controller.ts`
- Modify: `apps/gateway/src/controllers/videos/videos.controller.ts`
- Test: `apps/videos/src/app/app.controller.spec.ts`
- Test: `apps/gateway/src/controllers/videos/videos.controller.spec.ts`

**Step 1:** Write failing controller tests for overview, individual retry, and retry-failed commands.

**Step 2:** Add message commands and handlers. Require `videos.video.update` for gateway retry endpoints; keep overview owner-authorized with the same permission.

**Step 3:** Add routes before `:id` matching: `GET processing/overview`, `POST processing/retry-failed`, and `POST :id/retry-processing`.

**Step 4:** Re-run videos and gateway tests.

### Task 3: Build the Owner Console operations view

**Files:**

- Create: `apps/owner-console/src/app/services/video-processing.service.ts`
- Create: `apps/owner-console/src/app/components/video-processing-monitor.component.ts`
- Create: `apps/owner-console/src/app/components/video-processing-monitor.component.spec.ts`
- Modify: `apps/owner-console/src/app/app.routes.ts`
- Modify: `apps/owner-console/src/app/components/operations-workspace.component.ts`

**Step 1:** Write the component test for rendering summary totals, the recent-jobs table, disabled retries while loading, individual retry, and confirmed retry-all.

**Step 2:** Implement the API service using `/api/videos/processing/overview`, retry-one, and retry-failed endpoints.

**Step 3:** Implement a compact industrial operations panel: status metrics, last refresh, recent processing jobs, failure excerpts, auto-refresh every 10 seconds, and a confirmation dialog for bulk retry.

**Step 4:** Add the `/dashboard/video-processing` route and Operations entry card.

**Step 5:** Run the owner-console test target.

### Task 4: Verify the live processing pipeline

**Files:**

- No source changes required.

**Step 1:** Build videos, gateway, and owner-console through Nx.

**Step 2:** Refresh the relevant development containers without restarting shared infrastructure.

**Step 3:** Query the owner-console API through its SSR proxy. Confirm the overview reports active jobs and that retrying a failed job queues it rather than spawning unbounded ffmpeg processes.

**Step 4:** Run `git diff --check` and report the live queue state.
