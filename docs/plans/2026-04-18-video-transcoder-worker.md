# Video Transcoder Worker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Accept broad source video uploads, normalize them into MP4 + HLS, and expose processing state plus normalized playback URLs through the existing video stack.

**Architecture:** The `videos` Nest service remains the orchestration boundary. Uploaded source assets stay in the assets service, a dedicated Go `video-transcoder-worker` receives JSON-over-TCP jobs with source/output paths, and `videos` persists processing state plus derived asset IDs after ingesting the worker outputs back into the assets service. HLS is served through existing asset routes by storing the playlist and segment files as ordinary assets.

**Tech Stack:** NestJS, TypeORM, Nx run-commands, Go, TCP sockets, ffprobe/ffmpeg fallback, Docker Compose.

---

### Task 1: Add shared video processing contracts

**Files:**
- Modify: `libs/models/src/lib/libs/videos/video.dto.ts`
- Modify: `libs/ui-models/src/lib/ui-models/video/video.dto.ts`
- Modify: `libs/constants/src/lib/libs/videos.ts`
- Modify: `libs/constants/src/lib/libs/service.tokens.ts`
- Test: `apps/videos/src/app/app.controller.spec.ts`
- Test: `apps/gateway/src/controllers/videos/videos.controller.spec.ts`

**Steps:**
1. Write failing tests for new processing-aware controller payloads.
2. Add `VideoProcessingStatus` and playback fields to shared DTOs.
3. Add internal processing commands for mark-processing, complete-processing, and fail-processing.
4. Re-run the focused Jest specs.

### Task 2: Persist normalized playback state in videos service

**Files:**
- Modify: `apps/videos/src/entities/video.entity.ts`
- Create: `apps/videos/migrations/20260418-video-processing-pipeline.ts`
- Modify: `apps/videos/src/app/loadDatabase.ts`
- Modify: `apps/videos/src/app/services/video.service.ts`
- Modify: `apps/videos/src/app/app.controller.ts`
- Modify: `apps/videos/src/app/app.module.ts`
- Test: `apps/videos/src/app/app.controller.spec.ts`
- Test: `apps/videos/src/app/services/video.service.spec.ts`

**Steps:**
1. Write failing service tests for create-pending-video and processing state transitions.
2. Add entity columns and migration.
3. Teach `create()` to persist source asset IDs and queue processing.
4. Add update methods for processing success/failure.
5. Re-run focused video service tests.

### Task 3: Add worker client orchestration in videos service

**Files:**
- Create: `apps/videos/src/app/services/video-transcode-client.service.ts`
- Create: `apps/videos/src/app/services/video-processing.service.ts`
- Modify: `apps/videos/src/app/app.module.ts`
- Modify: `apps/videos/src/app/services/video.service.ts`
- Modify: `apps/videos/src/config.ts`
- Test: `apps/videos/src/app/services/video-processing.service.spec.ts`

**Steps:**
1. Write failing tests for asset lookup, worker dispatch, manifest rewriting, and status updates.
2. Implement JSON-over-TCP worker client.
3. Implement orchestration service that resolves source paths, dispatches the worker job, uploads derived assets, and updates the video row.
4. Re-run focused processing tests.

### Task 4: Broaden asset ingestion and MIME handling

**Files:**
- Modify: `libs/storage/src/lib/file-validation.service.ts`
- Modify: `libs/storage/src/lib/local-storage.ts`
- Modify: `apps/assets/src/app/app.service.ts`
- Test: `apps/assets/src/app/app.service.spec.ts`

**Steps:**
1. Write failing tests for source-video extensions, larger configurable size limits, and HLS MIME handling.
2. Expand allowed source/derived video types.
3. Fix stored asset naming so extensions are not duplicated.
4. Make local reads derive MIME from filename extension instead of coarse asset type.
5. Re-run focused asset tests.

### Task 5: Add the Go transcoder worker

**Files:**
- Create: `apps/video-transcoder-worker/project.json`
- Create: `apps/video-transcoder-worker/go.mod`
- Create: `apps/video-transcoder-worker/main.go`
- Create: `apps/video-transcoder-worker/internal/protocol/protocol.go`
- Create: `apps/video-transcoder-worker/internal/transcode/worker.go`
- Create: `apps/video-transcoder-worker/internal/transcode/worker_test.go`
- Create: `apps/video-transcoder-worker/Dockerfile`

**Steps:**
1. Write failing Go tests for request parsing and output contract generation.
2. Implement a low-overhead TCP server with newline-delimited JSON messages.
3. Use Go-native filesystem/process orchestration and fall back to `ffprobe`/`ffmpeg` for probe/transcode/package steps.
4. Re-run `go test` for the worker.

### Task 6: Wire playback preference and runtime integration

**Files:**
- Modify: `apps/video-client/src/app/services/video.service.ts`
- Modify: `apps/video-client/src/app/pages/watch/watch.component.ts`
- Modify: `libs/video-ui/src/lib/video-player/video-player.component.ts`
- Modify: `docker-compose.yaml`
- Modify: `docker-compose.dev.yaml`
- Modify: `apps/videos/Dockerfile`
- Test: `apps/video-client/src/app/services/video.service.spec.ts`

**Steps:**
1. Write failing UI/service tests for HLS-preferred playback URL selection.
2. Add HLS-aware playback fields with MP4 fallback.
3. Add the worker service plus shared asset/temp volumes to compose.
4. Re-run targeted frontend/backend verification.
