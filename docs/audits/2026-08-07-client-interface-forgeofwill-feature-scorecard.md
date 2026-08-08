# Client Interface and Forge of Will Feature Scorecard

## Scope

This is a source-and-test audit of the two Angular clients and their checked-in E2E suites. It covers advertised landing-page capabilities, reachable routes, UI/service seams, explicit TODOs, and existing verification. It does not claim live-browser behavior for flows that were not run during this planning pass.

Scoring uses user impact and verification confidence:

- **P0:** advertised core capability is visibly nonfunctional or misleading.
- **P1:** important advertised workflow is absent or lacks an end-to-end contract.
- **P2:** policy, copy, or access behavior needs a deliberate product decision.

## Findings

| App               | Capability                     | Evidence                                                                                                                                                                                        | Status                                      | Priority |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------- |
| Forge of Will     | AI project summary             | The projects page renders an `AI Project Summary` tile containing only static description text; no summary service or action is wired there.                                                    | Verified incomplete                         | P0       |
| Forge of Will     | AI assistant                   | The assistant path explicitly logs that creating a new AI conversation is not implemented.                                                                                                      | Verified incomplete                         | P0       |
| Forge of Will     | Team/small-group collaboration | Project invite API/service exists, but no project-page member/invite UI reference was found.                                                                                                    | High-confidence incomplete                  | P1       |
| Optimistic Tanuki | Events                         | Landing copy promises events in the core workflow, use cases, and rich-content feature; no event route/service/component was found in the scoped client.                                        | High-confidence gap; confirm product intent | P1       |
| Optimistic Tanuki | Public discovery               | Landing copy promises public posts discoverable outside the community; source contains feed/community surfaces, but no browser contract proves private/public isolation and outsider discovery. | Unverified                                  | P1       |
| Optimistic Tanuki | Real-time notifications        | Notification shell and WebSocket infrastructure exist, but the client E2E suite has no delivery/read-state flow.                                                                                | Unverified                                  | P1       |
| Optimistic Tanuki | Network onboarding             | Landing promises “Create Your Space” and invitations; current E2E journey covers registration/profile but not create-community → invite → join.                                                 | Unverified                                  | P1       |
| Forge of Will     | Forum access policy            | Forum appears in authenticated navigation, but its route has no app-level authentication guard.                                                                                                 | Needs decision                              | P2       |

## What is already evidenced as present

- Optimistic Tanuki has feed, profile, communities, forum, messages, notifications, activity, privacy, search, reactions, attachments, and OAuth/email routes.
- Forge of Will has project, task list/calendar/kanban, risks, changes, mind map, journal, timer handlers, profile, settings, forum, chat, and OAuth/email routes.
- Both clients now have cookie-session OAuth E2E coverage from the prior migration work.

## Residual questions

1. Is events a committed product capability backed by shared models/API, or should the landing copy be narrowed?
2. Should Forge forum be public-read or authentication-required?
3. What is the minimum acceptable AI behavior when the AI provider is unavailable?
4. Should project collaboration support invitations only, or also member roles, removal, and approval state?

The corresponding implementation plan is [2026-08-07-client-interface-forgeofwill-feature-completeness.md](../plans/2026-08-07-client-interface-forgeofwill-feature-completeness.md).
