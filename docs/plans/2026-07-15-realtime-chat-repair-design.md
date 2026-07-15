# Realtime Chat Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore Forge of Will Socket.IO routing, deliver client-interface messages through the chat socket, and retain sender profile presentation after reload.

**Architecture:** Browser chat clients use the same-origin Socket.IO engine path. Message creation moves to the gateway chat namespace so the gateway can persist and broadcast one canonical event. The client maps already-fetched participant profiles onto each conversation, allowing message rendering to resolve sender data by profile id after a reload.

**Tech Stack:** Angular, Socket.IO, NestJS, Jest, Nx, Playwright, Docker Compose.

---

### Task 1: Preserve the Socket.IO engine path in Forge of Will

**Files:**

- Modify: `apps/forgeofwill/src/server.ts`
- Test: `apps/forgeofwill/src/server-proxy.spec.ts`

1. Write a regression test requiring the proxy target to include `/socket.io`.
2. Run the focused test and confirm it fails.
3. Extract/use the proxy options in Forge SSR so a browser request mounted at `/socket.io` reaches the gateway Socket.IO engine endpoint.
4. Run the focused test and confirm it passes.

### Task 2: Send client-interface chat messages over Socket.IO

**Files:**

- Modify: `apps/client-interface/src/app/components/messages.component.ts`
- Test: `apps/client-interface/src/app/components/messages.component.spec.ts`

1. Write a regression test requiring submission to call `SocketChatService.sendMessage` and avoid the HTTP message creation endpoint.
2. Run the focused test and confirm it fails.
3. Send the normalized chat message over the existing socket service; let the gateway broadcast update the UI.
4. Run the focused test and confirm it passes.

### Task 3: Associate participant profiles with reloaded messages

**Files:**

- Modify: `apps/client-interface/src/app/components/messages.component.ts`
- Test: `apps/client-interface/src/app/components/messages.component.spec.ts`

1. Write a regression test requiring rehydrated conversations to include participant profiles keyed by participant id.
2. Run the focused test and confirm it fails.
3. Populate `participantProfiles` from the existing profile response when rebuilding conversations.
4. Run the focused test and confirm it passes.

### Task 4: Verify the browser and development stack

1. Run affected Nx unit tests and app builds.
2. Rebuild the shared Docker development stack using its checked-in pnpm workflow.
3. Confirm client-interface and Forge of Will are up, then run the narrow Chrome Playwright checks against the live stack.
