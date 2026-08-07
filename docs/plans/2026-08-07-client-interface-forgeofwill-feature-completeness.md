# Client Interface and Forge of Will Feature Completeness Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close or accurately reframe the advertised capabilities in `client-interface` and `forgeofwill`, with browser-verifiable acceptance coverage for every user-facing promise.

**Architecture:** Audit and repair each product at its owning application/library boundary. Reuse existing social, community, project, chat, notification, and design-system components; add shared behavior only when both clients need the same contract. Every repaired feature gets a focused unit/component test and a deterministic browser flow where the risk crosses routing, storage, WebSocket, or backend boundaries.

**Tech Stack:** Angular standalone applications, Nx, NestJS gateway/service APIs, shared Angular libraries, Jest, and Playwright through Nx.

---

## Audit scope and evidence

Reviewed source routes, landing-page promises, feature components, service/API seams, existing unit tests, and checked-in E2E coverage for both applications. No application code was changed during this audit.

| Finding                                                                                                                                                                                                  | Evidence                                                                                                                                                                                                                                                               | Confidence                                          | Priority |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------- |
| Forge advertises AI assistance and an AI project summary, but the project summary is static copy and assistant creation is explicitly unimplemented.                                                     | [landing feature copy](../../apps/forgeofwill/src/app/pages/landing/landing.component.ts:51), [static project tile](../../apps/forgeofwill/src/app/pages/projects/projects.component.html:141), [assistant TODO](../../apps/forgeofwill/src/app/chat.component.ts:455) | Verified gap                                        | P0       |
| Forge advertises team/small-group execution, but the existing project invite API has no project-page UI path.                                                                                            | [invite service](../../apps/forgeofwill/src/app/project/project.service.ts:53), [project page actions](../../apps/forgeofwill/src/app/pages/projects/projects.component.html:1)                                                                                        | High-confidence gap                                 | P1       |
| Optimistic Tanuki advertises events repeatedly, but the scoped client has no event route, event service, event component, or E2E flow.                                                                   | [landing promises](../../apps/client-interface/src/app/components/landing.component.html:256), [feature promise](../../apps/client-interface/src/app/components/landing.component.html:428), [client routes](../../apps/client-interface/src/app/app.routes.ts:79)     | High-confidence gap; confirm backend/product intent | P1       |
| Optimistic Tanuki advertises public discovery, but the source audit found no dedicated acceptance flow proving visibility controls and cross-network discovery.                                          | [public discovery promise](../../apps/client-interface/src/app/components/landing.component.html:405), [feed/community routes](../../apps/client-interface/src/app/app.routes.ts:79)                                                                                   | Open verification gap                               | P1       |
| Optimistic Tanuki advertises real-time connection/notifications; notification UI and WebSocket code exist, but there is no end-to-end notification delivery/read-state contract in the scoped E2E suite. | [real-time promise](../../apps/client-interface/src/app/components/landing.component.html:435), [notification shell](../../apps/client-interface/src/app/app.component.html:45), [E2E coverage](../../apps/client-interface-e2e/src)                                   | Open verification gap                               | P1       |
| Optimistic Tanuki’s “create your own network” onboarding is not covered from registration through community creation, invite, and member participation.                                                  | [network promise](../../apps/client-interface/src/app/components/landing.component.html:160), [community route](../../apps/client-interface/src/app/app.routes.ts:115), [current journey scope](../../apps/client-interface-e2e/src/user-journey.spec.ts:1)            | Open verification gap                               | P1       |
| Forge’s forum route is advertised in authenticated navigation but is not protected by the app’s authentication guard, unlike projects/profile/settings.                                                  | [Forge nav](../../apps/forgeofwill/src/app/app.component.ts:37), [forum route](../../apps/forgeofwill/src/app/app.routes.ts:50)                                                                                                                                        | Review required; may be intentional public access   | P2       |

## Implementation plan

### Task 1: Establish the feature acceptance matrix

**Files:**

- Create: `docs/audits/2026-08-07-client-interface-forgeofwill-feature-scorecard.md`
- Modify: `apps/client-interface-e2e/src/user-journey.spec.ts`
- Modify: `apps/forgeofwill-e2e/src/user-journey.spec.ts`

1. Turn the evidence table above into explicit acceptance rows: actor, starting route, action, expected UI state, expected API/WebSocket call, persistence requirement, and failure state.
2. Add only the smallest currently-missing smoke assertions for existing flows: client community creation/onboarding and Forge project workspace loading.
3. Run the new tests first and record failures before implementation work.

Run:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run client-interface-e2e:e2e-ci--src/user-journey.spec.ts
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run forgeofwill-e2e:e2e-ci--src/user-journey.spec.ts
```

### Task 2: Make Forge AI claims truthful and functional

**Files:**

- Modify: `apps/forgeofwill/src/app/pages/projects/projects.component.ts`
- Modify: `apps/forgeofwill/src/app/pages/projects/projects.component.html`
- Modify: `apps/forgeofwill/src/app/chat.component.ts`
- Modify: `apps/forgeofwill/src/app/ai-assistant-bubble/ai-assistant-bubble.component.ts`
- Test: `apps/forgeofwill/src/app/pages/projects/projects.component.spec.ts`
- Test: `apps/forgeofwill/src/app/chat.component.spec.ts` (create if absent)
- E2E: `apps/forgeofwill-e2e/src/user-journey.spec.ts` or a new focused AI spec

1. Choose the minimum supported AI contract: generate a project summary from the selected project, or remove the summary claim until the backend contract exists.
2. Add explicit loading, success, empty, timeout, and provider-error states; do not leave a tile that looks operational while rendering no data.
3. Complete AI assistant conversation creation through the existing chat transport, or replace the bubble action with a truthful disabled/unavailable state.
4. Add tests proving a new assistant action creates or opens a conversation and that a failed provider response is visible to the user.
5. Add a browser flow that opens the assistant from an authenticated Forge workspace and verifies the resulting conversation or deliberate unavailable state.

### Task 3: Expose Forge project collaboration

**Files:**

- Modify: `apps/forgeofwill/src/app/pages/projects/projects.component.ts`
- Modify: `apps/forgeofwill/src/app/pages/projects/projects.component.html`
- Modify/create: `libs/project-ui/src/lib/project-ui/project-overview/*` or a reusable project-members component
- Test: `apps/forgeofwill/src/app/project/project.service.spec.ts`
- Test: `apps/forgeofwill/src/app/pages/projects/projects.component.spec.ts`
- E2E: `apps/forgeofwill-e2e/src/project-collaboration.spec.ts`

1. Add an accessible project-members/invite surface to the project workspace using `ProjectService.inviteMember`.
2. Define invite success, duplicate invite, invalid email, permission denial, and network failure states.
3. Render existing members and invitation status from the project response; do not advertise team execution if the UI cannot manage membership.
4. Cover invite creation and resulting membership visibility in a deterministic E2E flow.

### Task 4: Resolve the Optimistic Tanuki events promise

**Files:**

- Decision/update: `apps/client-interface/src/app/components/landing.component.html`
- If implementing: create the owning event UI/service in `libs/community-ui` or a new shared event library, then wire `apps/client-interface/src/app/app.routes.ts` and community navigation.
- Test: community/event component tests and `apps/client-interface-e2e/src/community-events.spec.ts`

1. Confirm whether events are a supported product capability in the backend and shared models.
2. If yes, implement the smallest complete path: create event, list event, view event, and community-scoped permissions; include date/time/time-zone and empty/error states.
3. If no, remove or revise every landing claim that promises events, including the church, neighborhood, and rich-content copy.
4. Add a browser acceptance test so the marketing copy and reachable feature cannot drift independently again.

### Task 5: Verify and repair public discovery/privacy behavior

**Files:**

- Inspect/modify: `apps/client-interface/src/app/components/social/feed.component.ts`
- Inspect/modify: `apps/client-interface/src/app/components/social/feed.component.html`
- Inspect/modify: `apps/client-interface/src/app/components/profile.component.*`
- Inspect/modify: `apps/client-interface/src/app/components/settings/privacy-settings.component.ts`
- Test: `apps/client-interface/src/app/components/social/feed.component.spec.ts`
- Test: `apps/client-interface-e2e/src/community-permissions.spec.ts`
- E2E: create `apps/client-interface-e2e/src/public-discovery.spec.ts`

1. Trace the post/community visibility model from the composer through gateway persistence and public feed/search reads.
2. Verify that private-by-default content is inaccessible to an outsider and that an explicitly public post is discoverable without membership.
3. Verify profile/community privacy controls, block/mute/report behavior, and action URLs in the browser.
4. Repair missing controls or backend/UI mismatches; otherwise document the verified contract in the scorecard.

### Task 6: Verify real-time notifications and direct messages

**Files:**

- Inspect/modify: `apps/client-interface/src/app/app.component.ts`
- Inspect/modify: `apps/client-interface/src/app/components/notifications/notifications-page.component.ts`
- Inspect/modify: `apps/client-interface/src/app/components/messages.component.ts`
- Inspect/modify: notification/chat shared libraries only if the gap is shared
- Test: relevant notification/chat component and service specs
- E2E: extend `apps/client-interface-e2e/src/chat.spec.ts` and add a focused notification spec

1. Verify notification delivery from a second user action, unread count updates, mark-read persistence, and action navigation.
2. Verify direct-message send, reconnect/reload persistence, presence, and the current “Clear all” behavior against the server contract.
3. Replace local-only behavior or misleading labels where the UI claims a server-side operation but only mutates signals.
4. Keep WebSocket timing deterministic with explicit readiness and event assertions; do not use arbitrary sleeps.

### Task 7: Review Forge forum access policy

**Files:**

- Decision/modify: `apps/forgeofwill/src/app/app.routes.ts`
- Test: `apps/forgeofwill-e2e/src/user-journey.spec.ts` or a focused forum access spec

1. Decide whether Forge forum is intentionally public or authenticated-only.
2. If authenticated-only, add the same authentication/profile protection used by project routes and verify anonymous redirect.
3. If public, add an explicit public-read test and keep write actions permission-gated.

### Task 8: Finish with cross-app verification

**Files:**

- Modify: `apps/client-interface-e2e/src/*` only for the final regression coverage
- Modify: `apps/forgeofwill-e2e/src/*` only for the final regression coverage
- Update: `docs/audits/2026-08-07-client-interface-forgeofwill-feature-scorecard.md`

Run the smallest failing E2E slice first, then the affected application suite, then shared-library tests and lint/build targets through Nx. Re-score every finding as fixed, partially fixed, revised copy, or still open, and preserve residual risks in the audit artifact.

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run-many -t test -p client-interface forgeofwill
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run client-interface-e2e:e2e-ci
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run forgeofwill-e2e:e2e-ci
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run-many -t lint -p client-interface forgeofwill client-interface-e2e forgeofwill-e2e
```

## Recommended order

1. Forge AI claims and static summary (highest user-facing contradiction).
2. Forge project collaboration/invites (advertised team value with an existing backend seam).
3. Optimistic Tanuki events decision and implementation/copy correction.
4. Public discovery/privacy acceptance flow.
5. Notifications/messages reliability and persistence.
6. Forge forum access-policy decision.

No implementation was performed as part of this planning pass. Existing migration changes in the working tree were preserved.
