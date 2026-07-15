# Runtime Socket Path Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configure Forge of Will and Client Interface Socket.IO transport routing at runtime, including production `/ws` support.

**Architecture:** Add a shared `SOCKET_PATH` injection token to chat UI and pass it to Socket.IO's `path` option. Each SSR UI injects `SOCKET_URL` and `SOCKET_PATH` into `window.env`; Compose forwards those environment variables to UI containers. The default remains same-origin `/socket.io` for local development.

**Tech Stack:** Angular SSR, Socket.IO client, Docker Compose, Nx/Jest.

---

### Task 1: Add shared Socket.IO transport-path support

**Files:**

- Modify: `libs/chat-ui/src/lib/socket-chat.service.ts`
- Modify: `libs/chat-ui/src/lib/socket-chat.service.spec.ts`

**Step 1: Write a failing test**

Assert that a configured socket path is passed to the Socket.IO client.

**Step 2: Run the focused test**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run auth-ui:test --testFile=libs/chat-ui/src/lib/socket-chat.service.spec.ts --skip-nx-cache`

Expected: FAIL because the path option is absent.

**Step 3: Implement the token and option**

Add `SOCKET_PATH`, inject it with `/socket.io` as the default, and pass it as the Socket.IO `path` option.

**Step 4: Re-run the focused test**

Expected: PASS.

### Task 2: Supply runtime values from both SSR UIs

**Files:**

- Modify: `apps/client-interface/src/app/app.config.ts`
- Modify: `apps/client-interface/src/app/app.config.spec.ts`
- Modify: `apps/client-interface/src/server.ts`
- Modify: `apps/client-interface/src/app/social-websocket.service.ts`
- Modify: `apps/forgeofwill/src/app/app.config.ts`
- Modify: `apps/forgeofwill/src/server.ts`

**Step 1: Write a failing app-config test**

Assert that `window.env.SOCKET_PATH` is preferred over `/socket.io`.

**Step 2: Implement runtime providers and SSR injection**

Provide `SOCKET_PATH` in both apps, render `SOCKET_URL` and `SOCKET_PATH` into SSR HTML, and apply the path to Client Interface's social socket.

**Step 3: Re-run affected tests**

Expected: PASS.

### Task 3: Forward environment configuration in Compose

**Files:**

- Modify: `docker-compose.yaml`
- Modify: `.env.sample`

**Step 1: Add the two pass-through variables**

Add `SOCKET_URL` and `SOCKET_PATH` to the shared browser-client environment, defaulting the path to `/socket.io`.

**Step 2: Inspect resolved Compose configuration**

Run: `docker compose --env-file /dev/null -f docker-compose.yaml config --format json`

Expected: client services receive `SOCKET_URL` and `SOCKET_PATH`.
