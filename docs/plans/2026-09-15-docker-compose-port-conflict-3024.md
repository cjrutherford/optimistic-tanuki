# Docker Compose 3024 Port Conflict Resolution

## Context

`workspace` and `learning-service` were both publishing host port `3024` in `docker-compose.yaml`, which causes a bind conflict when both services start.

## Change Applied

- Updated `learning-service` publish mapping in `docker-compose.yaml`:
  - from `${LEARNING_SERVICE_PORT:-3024}:3024`
  - to `${LEARNING_SERVICE_PORT:-3026}:3024`
- `workspace` remains on `${WORKSPACE_PORT:-3024}:3024`.
- Both containers still listen on internal port `3024`; only the host-side default for `learning-service` changed.

## Why This Fix

- Resolves local Docker host port collision with the smallest possible change.
- Avoids touching gateway internal service-to-service routing, which still targets `learning-service` on container port `3024`.
- Avoids unnecessary changes to Kubernetes manifests and e2e compose files where internal service ports remain valid.

## Follow-up Notes

- If local tooling or scripts assumed `http://localhost:3024` for `learning-service`, use `http://localhost:3026` or set `LEARNING_SERVICE_PORT=3024` only when `workspace` is not running.
- Consider updating documentation that describes the local published learning-service port:
  - `docs/learning-platform/deployment.md`
  - `docs/learning-platform/architecture-and-implementation-plan.md`
