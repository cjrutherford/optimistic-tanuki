# Slices 07 and 08: implementation and acceptance status

Date: 2026-09-27. Branch: `develop/site-copy-review`. All work is in the current, uncommitted checkout.

## Slice 07 — Civic Core

Implemented the dedicated Civic TCP service, tenant-isolated Postgres tables, Gateway Civic routes, official Savannah city-council and MPC agenda discovery/import, searchable agenda items, GeoJSON TIP projects, emergency broadcasts, a MapLibre public app, and its accessibility-focused UI/E2E coverage. The service and app are included in the workspace build and Docker configuration. The Civic source importer deduplicates unchanged documents and refreshes changed documents at the same URL. Roman-numbered MPC sections are parsed and stored in printed order, even when PDF text extraction reverses heading order. Dated index entries use noon UTC so an Eastern calendar date renders on the stated date.

Evidence: Civic tests 21/21, build/lint pass; Civic UI tests 15/15, build/lint pass; static Chrome E2E 6/6; Docker compose configuration valid. Both generated Civic migrations ran in an isolated database, and the TypeORM migration validator passed. With the Civic service running against that database, source polling imported official Savannah council and MPC agendas. The October 27 MPC PDF produced 14 sections in sequence `I` through `XIIII`; TIP bounding-box queries, emergency broadcast expiry, and cross-tenant isolation were exercised through the live TCP service.

Acceptance limit: the full Gateway, Civic, and browser stack was unavailable locally, so the deployed HTTP routes and live browser SSE appearance/expiry have not been exercised together. Two future MPC links currently return HTTP 404 from the public source; polling logs those failures and continues. The app renders GeoJSON directly in MapLibre rather than a separate vector-tile server. Accessibility checks cover tested keyboard and announcement flows, not a formal WCAG certification.

## Slice 08 — HAI ROI and contact acknowledgment

Implemented the interactive five-year comparison calculator, selected-tier lease cost, HAI public contact copy, and server-owned lead acknowledgment deadline. The one-hour clock counts Monday–Friday 9:00am–5:00pm America/New_York; nights and weekends pause it. It starts at lead creation and is met only by a successful personal owner response through the lead workflow. Automatic receipts do not meet it. Service timing remains task-dependent, without a same-day onsite promise.

Gateway resolves all eligible Owner Console owners from scoped role assignments and email addresses, then submits a trusted recipient list with the HAI lead. Lead Tracker stores the deadline and first personal response time and uses a durable per-recipient outbox for intake and breach notices. Owner Console presents a shared owner-only HAI queue and the server deadline/status. Ordinary profile lead queries exclude HAI leads. The generated Lead Tracker migration ran against a fresh isolated database and passed the migration validator.

Evidence: HAI tests 66/66; Gateway tests 1,427/1,427; Lead Tracker tests 212/212; Owner Console tests 663/663. Their production builds and lint checks passed. The aggregate development build passed with Civic and its UI included. In an isolated live Lead Tracker run, a HAI submission stored a Monday 10am Eastern deadline for a Sunday intake, queued/sent two owner intake notices through the console mail provider, blocked an invalid reply destination, recorded a successful personal response, and suppressed both breach notices. Business-hour boundaries, owner resolution, role exclusion, and on-time/late response behavior also have focused tests.

Acceptance limit: a complete authenticated HAI browser → Gateway → SMTP → Owner Console scenario was not run because the full local stack and real SMTP delivery were unavailable. External inbox delivery and a live overdue worker restart remain to be checked in an environment with those services. Outbox delivery is at least once: a provider acceptance followed by a process crash before the sent state is saved can resend a notice. The agreed calendar excludes nights and weekends; no holiday exclusion was specified.

## Next

Before calling the slices production accepted, run the full stack and verify Civic HTTP/SSE and HAI intake-to-all-owner inbox delivery, owner acknowledgment, and overdue escalation with configured SMTP. Then take Slices 09–11 in order: portfolio grid/identity, six-app architecture showcase/Systems Lab, and the BTO appliance portal.
