# S0 capability ledger — business directory POC to Town Square

**Subsequent decisions and evidence:** The user approved the ownership boundary, UUID-based overlap policy and automatic geography resolution with pending status; see [the ADR](S0-inventory-and-adr.md). A [private selected-file snapshot](S0-snapshot-report.md) and [row-level local town census](S0-town-census.md) now exist. The user requested role-based reviewer proposals rather than naming people at this stage. The open-gap statements below are historical where these updates supersede them; snapshot exclusions, later source-use approval and authoritative-deployment checks remain open.

**State: inventory draft; S0 is not accepted.** This file is the route, worker, provider, UI, library and deployment ledger requested by the integration plan. Source paths are relative to `/home/cjrutherford/workspace/business-directory-poc`; target paths are relative to this checkout. It records capabilities and proposed ownership only. It grants no source-data transfer, provider use, spend, publication or implementation approval.

**Evidence basis:** POC branch `feat/directory-poc-slice-1`, HEAD `9948a2371fee6051c49932bfae7dcf6e732efc0a`; existing [source provenance manifest](S0-source-manifest.md), observed 2026-11-04T15:18:36Z, says 187 changed paths (107 tracked modified, 80 untracked), no staged/deleted/renamed paths. That manifest hashes selected safe source/test/docs paths but explicitly excludes configuration, data, browser captures and generated proof; it is not a reconstructable snapshot and does not include retained diffs. Source state may have changed since the observation. The POC checkout contains 132,952 files when unrestricted `rg --files -uuu` is used (including dependencies, generated output and data); the relevant non-generated source/config/docs enumeration was 682 files after excluding `.git`, dependencies, `dist`, `data` and coverage. The 80 untracked paths classify as 21 persistence files, 14 Playwright capture files, 11 `tools/overture` paths, 8 API paths, 7 provider paths, 5 worker paths, 4 directory UI paths, 3 POC UI paths, 2 contracts paths, 2 docs paths, 1 orchestration path, 1 domain path and 1 config path. We inspected the runtime code paths below and reviewed the path-level additions in the existing manifest, but did **not** inspect every untracked source/tool/config content or any browser capture, proof artifact, ignored/generated or data payload. Their lineage and contents remain unresolved. Therefore this ledger does not claim an exhaustive working-tree/content or data census. No secret values were read or copied.

## API controller and route inventory

All route paths below are the Nest controller prefix plus method path. Public and operator applications are separately composed in `apps/directory-api/src/main.ts` and `apps/directory-api/src/app/listeners.ts`; the OpenAPI file is produced by merging the two listener documents.

| Surface / method + path | Source | Capability and proposed target owner / slice |
|---|---|---|
| Public `GET /api/v1/businesses` | `apps/directory-api/src/app/businesses/businesses.controller.ts` | Approved business search; directory read API + shared data access, S2/S5; use Community UUID mapping and public-field policy. |
| Public `GET /api/v1/businesses/map-points` | `apps/directory-api/src/app/businesses/businesses.controller.ts` | Cursor-paginated approved map points; directory read API + shared map UI, S2/S5; geometry/privacy/filter contract pending. |
| Public `GET /api/v1/businesses/:id` | `apps/directory-api/src/app/businesses/businesses.controller.ts` | Approved detail; directory API and Town Square public business/detail route, S5/S6; owner-managed business-page linkage remains separate. |
| Public `GET /api/v1/regions` | `apps/directory-api/src/app/businesses/businesses.controller.ts` | Validated derived regions; geography contract S2 and public API S5; remove four-seat/corridor assumptions. |
| Operator `POST /api/v1/operator/discovery-runs` | `apps/directory-api/src/app/discovery/discovery.controller.ts` | Create/reuse run; directory worker orchestration, S3/S4; authorization and automatic onboarding gate pending. |
| Operator `POST /api/v1/operator/discovery-runs/geoapify-dev` | `apps/directory-api/src/app/discovery/discovery.controller.ts` | Private Waycross restaurant request; keep explicitly dev-only or retire; S0 decision, then S4b only after source policy and budget approval. |
| Operator `GET /api/v1/operator/discovery-runs/geoapify-dev/budget` | `apps/directory-api/src/app/discovery/discovery.controller.ts` | UTC-day dev allowance; S4b if retained; hard-budget semantics and paid provider approval pending. |
| Operator `GET /api/v1/operator/discovery-runs/latest` | `apps/directory-api/src/app/discovery/discovery.controller.ts` | Latest run status; S3/S7. |
| Operator `GET /api/v1/operator/discovery-runs/:id` | `apps/directory-api/src/app/discovery/discovery.controller.ts` | Progress/completeness; S3/S7. |
| Operator `POST /api/v1/operator/discovery-runs/:id/cancel` | `apps/directory-api/src/app/discovery/discovery.controller.ts` | Durable cancellation; S3/S7, including authorization/audit. |
| Operator `POST /api/v1/operator/discovery-runs/:id/resume` | `apps/directory-api/src/app/discovery/discovery.controller.ts` | Resume eligible unfinished provider jobs; S3/S4, preserve checkpoint/manifest semantics. |
| Operator `GET /api/v1/operator/review-tasks` | `apps/directory-api/src/app/review/review.controller.ts` | Review queue; S7; restricted operator role and audit contract pending. |
| Operator `GET /api/v1/operator/review-tasks/:id` | `apps/directory-api/src/app/review/review.controller.ts` | Review detail; S7. |
| Operator `POST /api/v1/operator/review-tasks/:id/decisions` | `apps/directory-api/src/app/review/review.controller.ts` | Merge/keep/reject-type adjudication; S7, retain optimistic concurrency and audit. |
| Operator `POST /api/v1/operator/review-tasks/:id/undo` | `apps/directory-api/src/app/review/review.controller.ts` | Reversible merge undo; S7, ensure privacy withdrawal and rollback behavior. |
| Operator `POST /api/v1/operator/exports` | `apps/directory-api/src/app/exports/exports.controller.ts` | Queue policy-filtered export; S8; independent export rights, expiry and artifact access gates pending. |
| Operator `GET /api/v1/operator/exports/:id` | `apps/directory-api/src/app/exports/exports.controller.ts` | Export job status; S8; artifact download route is not present in this controller inventory. |
| Operator `GET /api/v1/operator/overture-rights-cases` | `apps/directory-api/src/app/rights/overture-rights.controller.ts` | List rights cases; S4/S7, authorized source-policy reviewer required. |
| Operator `GET /api/v1/operator/overture-rights-cases/:id` | `apps/directory-api/src/app/rights/overture-rights.controller.ts` | Rights evidence/history; S4/S7; never expose raw private evidence publicly. |
| Operator `POST /api/v1/operator/overture-rights-cases/:id/decisions` | `apps/directory-api/src/app/rights/overture-rights.controller.ts` | Record exclusion/terms evidence; S4/S7; code decision does not establish upstream rights. |
| Operator `GET /api/v1/operator/overture-taxonomy-cases` | `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.controller.ts` | Held taxonomy cases; S4/S7; retain place-type/category evidence and release/mapping identity. |
| Operator `GET /api/v1/operator/overture-taxonomy-cases/:id` | `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.controller.ts` | Preview/provenance/immutable decision history; S7. |
| Operator `POST /api/v1/operator/overture-taxonomy-cases/:id/decisions` | `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.controller.ts` | Auditable category/reject/defer decision; S7; assignment remains held per controller summary. |
| Health `GET /health` | `apps/directory-api/src/app/health/health.controller.ts` | Liveness; S1/S9; verify dependency-failure behavior in target service. |
| Health `GET /ready` | `apps/directory-api/src/app/health/health.controller.ts` | Startup/dependency readiness; S1/S9; verify fail-closed behavior in target service. |
| Metrics `GET /metrics` | `apps/directory-api/src/app/metrics.controller.ts` | Prometheus text; S1/S9; ensure private operator/monitoring boundary. |
| Scaffold `GET /` (default `AppController`) | `apps/directory-api/src/app/app.controller.ts` | Returns `AppService` data; `AppModule` is not imported by the actual dual-listener bootstrap in `main.ts`, so this is not currently on either documented listener. Confirm no alternate entrypoint uses it; S0 pending disposition. |

These are all controller-decorated routes found under `apps/directory-api/src`, including the default-module scaffold route. `AppModule`/`AppController` is not imported by the actual two-listener bootstrap, which imports `PublicListenerModule` and `OperatorListenerModule`; another executable entrypoint remains unverified.

### Module and authorization boundary

`PublicListenerModule` imports config, observability, shared persistence, health and `PublicModule`; `PublicModule` imports business persistence and `BusinessesModule`. `OperatorListenerModule` imports the same shared infrastructure plus health and `OperatorModule`; operator imports discovery, review, exports, rights, taxonomy and metrics. `main.ts` starts separate Nest applications on configured `publicListener` and `operatorListener` host/ports. At application level, this is **listener/module isolation, not demonstrated user authentication**: inspection found no guards, auth middleware, role decorators or permission checks on these controllers. `docker-compose.yml` puts API on public and operator Docker networks, binds operator-proxy to loopback host port by default, and `operator-proxy` joins only the operator network. A public-probe asserts operator paths return 404 on the public listener and operator listener is not reachable on public network. This is useful network isolation evidence, not identity-based authorization. Target: gateway permission boundary + directory API topology in S1/S5/S7; named security owner and operator role model are pending human assignment. Keep metrics and operator controls off public routing.

## Worker queue, processor and injection inventory

`apps/directory-worker/src/app/worker.module.ts` registers `DISCOVERY_QUEUES` in BullMQ; persistence-conditioned providers (enabled when `DATABASE_URL` exists) include handlers, export, outbox relay and retention scheduler. Every processor below extends `WorkerHost` and implements `process(job)`; the queue name is the binding.

| Queue / processor | Source | Handler, tokens and responsibility | Target / slice |
|---|---|---|---|
| `discovery-plan` / `DiscoveryPlanProcessor` | `apps/directory-worker/src/app/queues/discovery-plan.processor.ts` | Enqueues per-provider jobs on `provider-fetch`; discovery plan orchestration. | Worker and Community onboarding/reconciliation, S3. |
| `provider-fetch` / `ProviderFetchProcessor` | `apps/directory-worker/src/app/queues/provider-fetch.processor.ts` | Injects `DIRECTORY_PROVIDER_FETCH_HANDLER`; optional state/run repositories, `normalize` and own queue, telemetry/observability. | Provider abstraction and guarded acquisition, S3/S4. |
| `normalize` / `NormalizeProcessor` | `apps/directory-worker/src/app/queues/normalize.processor.ts` | Enqueues `dedupe`; optional `DIRECTORY_STAGE_LEDGER`, `NormalizationDedupeService`, telemetry/observability. | Normalization/provenance, S4. |
| `dedupe` / `DedupeProcessor` | `apps/directory-worker/src/app/queues/dedupe.processor.ts` | Optional stage ledger and normalization service; commits observations and creates search-index handoff. | Identity/dedupe, S4/S5. |
| `search-index` / `SearchIndexProcessor` | `apps/directory-worker/src/app/queues/search-index.processor.ts` | Optional stage ledger and business repository; refreshes search document and records index state. | Directory search projection, S5. |
| `export` / `ExportProcessor` | `apps/directory-worker/src/app/queues/export.processor.ts` | Persistence-only registration; claims/leases export jobs and writes artifacts to optional `EXPORT_OUTPUT_DIRECTORY`. | Restricted export worker, S8. |
| `outbox-relay` / `OutboxRelayProcessor` | `apps/directory-worker/src/app/queues/outbox-relay.processor.ts` | Persistence-only; `WorkerOutboxRelayHandler` wraps `OutboxRelayService`; service factory binds `ExportOutboxService` and `discovery-plan`, `search-index`, `export` queues. | Reliable event relay, S3/S9. |

`DIRECTORY_STAGE_LEDGER` is factory-bound to `RedisStageLedger` using configured Redis URL. `DIRECTORY_FIXTURE_PROVIDER_FETCH_HANDLER` is `useExisting: FixtureProviderFetchHandler` (`apps/directory-worker/src/app/queues/fixture-provider-fetch.handler.ts`); `OVERTURE_SAMPLE_PROVIDER_FETCH_HANDLER` is `useExisting: OvertureSampleProviderFetchHandler` (`apps/directory-worker/src/app/queues/overture-sample-provider-fetch.handler.ts`); `DIRECTORY_PROVIDER_FETCH_HANDLER` is `useExisting: OvertureFullReleaseProviderFetchHandler` (`apps/directory-worker/src/app/queues/overture-full-release-provider-fetch.handler.ts`). Full-release handler injects fixture and optional sample handlers and selects/falls back based on run/provider mode. Sample handler injects fixture handler and `OVERTURE_SAMPLE_SOURCE_POLICY`. `FixtureProviderRegistry` (`apps/directory-worker/src/app/queues/fixture-provider-registry.ts`) is persistence-conditioned. `ExportProcessor`, outbox relay processor/handler/service, Overture taxonomy quality/classification repositories, Geoapify retention service/scheduler are also persistence-conditioned. Inventory the queue list and optional-provider/no-database behavior in `DISCOVERY_QUEUES` and `worker.module.ts` before deployment design is frozen.

`GeoapifyDevRetentionScheduler` runs an initial enforcement and then a configurable interval (default 60 seconds). `OutboxRelayScheduler` upserts a BullMQ repeating job (default every 1 second; configurable) for `outbox-relay`; it is a scheduler, not a processor. Both scheduling and readiness behavior belong in S9 operations evidence. Provider fetch has a cancellation poller; export uses lease heartbeat. These are implementation capabilities, not proof of production recovery or SLOs.

## Provider adapters and execution modes

| Adapter / evidence | Current execution evidence | Target / slice; status |
|---|---|---|
| `libs/providers/src/lib/overture/overture-places.adapter.ts`, `overture-bulk-reader.ts`, `overture-release-scan.ts`, `overture-regional-policy.ts` | Bulk release scan over a staged local artifact/reader; full-release worker validates manifest and checksums. Current scan policy carries four-seat/Waycross constraints and is not generalized. `executionMode: 'live'` in the handler describes a live-mode scan of staged data, not an upstream network API call. | Overture-first candidate; S4a, subject to field/source rights and release review. Preserve manifest, checksums, checkpoints, release/schema/taxonomy versions and quality exclusions. |
| `overture-sample-reader.ts`, sample handler and `test/fixtures/providers/overture.json` | Bounded sample/local mode; falls back to fixture handler when sample mode is not usable. Not production coverage. | Clearly isolated development/fixture path; S0 inventory, S4a adapter policy. |
| `libs/providers/src/lib/geoapify/geoapify-places.adapter.ts`; dev controller/handler | HTTP page adapter exists; wired development path is explicitly Waycross restaurant scoped, gated by live flags/API key, with budget and retention controls. No provider calls were made for this inventory. | S4b optional; keep calls disabled pending rights, pricing, retention, per-run reservation and approved ceiling. |
| `libs/providers/src/lib/alltheplaces/alltheplaces.adapter.ts` and staging readers | `FixtureProviderRegistry.get('alltheplaces')` binds this adapter and stages an in-memory synthetic JSONL archive through `FixtureAllThePlacesArchiveReader`. This establishes a fixture path, not a live archive binding. | S4c supplemental; live use remains pending source terms, archive integration, budget and policy. |
| `libs/providers/src/lib/web/allowlisted-public-web.adapter.ts` | `FixtureProviderRegistry.get('allowlisted_web')` binds the adapter to a synthetic JSON-LD response supplied by an in-memory transport. This is a worker fixture path, not proof of a live crawler or permission to crawl. | Target purpose remains open for S10 disposition; any live use needs a separately reviewed source, access and retention policy and implementation. |
| `FixtureProviderRegistry`, `FixtureProviderFetchHandler`, `test/fixtures/providers/*` | The registry supplies fixture data and injected failures; it also contains a separately guarded live Geoapify development branch. The fixture handler is a fallback in the provider token chain, so its name alone does not establish offline behavior. | Fixtures are dev/test only; production must fail closed rather than silently claim real coverage from fixtures. Live provider work remains separately gated (S1/S4/S9). |
| `libs/providers/src/lib/provider-adapter.ts`, `provider-policy.ts`, `provider-types.ts`, crawl safety and exhaustion-proof modules | Shared adapter contracts validate URLs, costs, result windows, completion/checkpoint and terminal/exhaustion evidence. | Reuse contracts only after target/provider terms and implementation owner review, S4. |

No live upstream provider request was performed. Presence of an adapter is not evidence of permitted use, working credentials, live response, complete geography, or production wiring. Confirm adapter registration, runtime mode switches, source policy/version and fixture fallback behavior in an approved integration slice.

## Public and operator UI routes

Source route table: `apps/directory-poc/src/app/app.routes.ts`; all pages are lazy-loaded. The POC shell is a local app, not the target Town Square route surface.

| POC route | Page source | Target / slice |
|---|---|---|
| `/` → redirect `/search` | `apps/directory-poc/src/app/app.routes.ts` | Town Square directory entry; S6. |
| `/search` | `apps/directory-poc/src/app/pages/search-page.component.ts` | Search/results/map via shared `directory-ui` and data access; S5/S6. |
| `/regions` | `apps/directory-poc/src/app/pages/regions-page.component.ts` | Region browsing; shared UI and general geography S2/S6. |
| `/businesses/:id` | `apps/directory-poc/src/app/pages/detail-page.component.ts` | Public detail and evidence; S5/S6; owner-managed page linkage only after verified authority. |
| `/operator` | `apps/directory-poc/src/app/pages/run-page.component.ts` | Run/status/cancel/resume; restricted operator UI, S7. |
| `/operator/reviews` | `apps/directory-poc/src/app/pages/review-page.component.ts` | Human adjudication/undo; S7. |
| `/operator/classification-review` | `apps/directory-poc/src/app/pages/taxonomy-classification-review-page.component.ts` | Held taxonomy decisions; S7. |
| `/operator/rights-review` | `apps/directory-poc/src/app/pages/overture-rights-review-page.component.ts` | Rights review/exclusions; S4/S7. |

## Supporting libraries and capability ownership

| Source package / evidence | Capability | Proposed target owner / slice |
|---|---|---|
| `libs/contracts`, generated OpenAPI, `libs/domain` | DTOs/contracts, statuses, stable serialization, normalization, provider and search contracts | Target API/domain contracts; S1/S2/S4/S5/S7/S8; regenerate via target tooling, do not blindly copy generated output. |
| `libs/persistence` entities, repositories, modules, migrations | Business/observation/field evidence, locality/service regions, provider jobs/runs/state, review, rights/taxonomy, export/outbox, audit data | Directory-owned schema and repositories S1/S2/S4/S7/S8; Community remains owner of locality identity. Generate target migrations via owning Nx target. |
| `libs/geo` | Geometry validation, region derivation, seat/input manifests | Town geometry contract S2; replace seat assumptions with approved Community geometry. |
| `libs/search`, `libs/directory-data-access` | Search query logic, API client, client store, cursor/idempotency/error handling | Shared target read model/client S5/S6. |
| `libs/directory-ui` | Search/results/map/detail/evidence/run progress components | Shared platform UI S6/S7; preserve reuse and map attribution. |
| `libs/orchestration` | Discovery orchestration, provider fetch, checkpoint/stage ledger, retries, safety breaker, outbox publisher/relay, dedupe, Geoapify retention | Directory worker reliability S3/S4/S9; prove restart/idempotency/withdrawal. |
| `libs/providers` | Adapter contracts, Overture/Geoapify/AllThePlaces/web adapters, source policies, taxonomy and exhaustion proof | S4a/S4b/S4c, each provider individually gated; no unapproved provider. |
| `libs/exports` | Export schema/formatting and policy-aware output | S8, separate export rights and expiry gates. |
| `libs/config` | Provider/run/deadline/budget/listener configuration | Target config S1/S4/S9; remove unsafe defaults and fail closed. |
| `libs/observability` | Correlation, request/job telemetry, metrics and readiness signals | Target service S1/S9; redact sensitive data and keep metrics private. |
| `libs/evaluation` | Evaluation/adjudication scoring | Quality review tooling S7/S10; thresholds and human review owner pending. |

Untracked source in the manifest adds Overture address correction/checkpoint/release scan and taxonomy mapping/classification/evidence replay/repair capabilities, plus corresponding persistence entities/migrations and tests. Preserve these as distinct versioned, auditable work: S4a policy and provenance, S7 review/reclassification and bounded dry-run/apply/rollback tools, S9 restart/replay. Exact ownership/disposition for each data-repair script remains pending until scripts and operational effects are reviewed; never run them against the POC database as part of S0.

## Deployment and runtime topology

`docker-compose.yml` defines `postgres` (PostGIS), `redis`, `api` (both public/operator Nest listeners), `operator-proxy` (nginx), `worker`, and `public-probe`; named volumes persist Postgres, Redis and export artifacts. Public API host binding defaults to loopback port 4610; operator proxy defaults to loopback 4611. API joins public and operator networks; operator proxy and worker are operator-network only; Postgres/Redis serve internal dependencies. The API receives read-only staged Overture volume plus export volume; worker receives read-only sample/full-scan inputs and export output volume. Healthchecks cover databases, API readiness, proxy health and worker health; public-probe checks operator routes are absent from public listener. Local POC compose values include development defaults and must not be carried into target production configuration.

Target owner: directory API/worker service composition, gateway, local-hub compose profiles and platform operations S1/S9. Pending: approved service/project names and directories, DB/schema and queue ownership, credential/network policy, ports, health/readiness contract, production secret management, no-fixture production mode, migration/rollback path, data mount strategy, backup/retention, and whether a distinct operator listener is retained behind target gateway authorization.

## Target slice mapping and pending decisions

## Target owner anchors (from the integration plan)

| Capability group | Target owner / concrete integration anchor | Slice |
|---|---|---|
| Town identity, eligibility, privacy and reconciliation | Social owns Community UUID and scope: `apps/social/src/entities/community.entity.ts`, `libs/social/contracts/src/lib/community.ts`, `apps/social/src/app/services/community.service.ts`; gateway boundary `apps/gateway/src/controllers/social/community/community.controller.ts`. | S1/S2/S3 |
| Runtime API, worker, persistence and queues | Existing target projects `apps/directory` and `apps/directory-worker`; Directory has its own database, with local infrastructure accepted by the user. Production credentials, queue topology and operational evidence remain S9 work. | S1/S3/S9 |
| Public directory routes and client | Local Hub town context `apps/local-hub/src/app/app.routes.ts`, `pages/city/city.component.ts` and `.html`; directory-specific client under `libs/business-data-access/src/lib/business-api.service.ts` after compatibility check. | S5/S6 |
| Shared public presentation/map | Reuse candidates `libs/business-ui/src/lib/business-ui/{business-list.component.ts,business-card.component.ts,business-detail.component.ts}` and `apps/local-hub/src/app/components/map/map.component.ts`; add truthful directory listing contract, no synthetic subscription fields. | S6 |
| Existing owner-managed pages and billing | Keep separate from acquired observations: `apps/payments/src/entities/business-page.entity.ts`, `apps/local-hub/src/app/services/payment.service.ts`, `libs/business-ui/src/lib/business-ui/models.ts`. | S5/S6; entitlement decision pending |
| Restricted operator and audit functions | Authenticated gateway and Directory operator API, with private operator pages in `apps/owner-console` as directed by the user; direct POC listener exposure is not a target boundary. Specific APIs, permissions and audit evidence remain open. | S1/S7/S8 |
| Integration verification | `apps/local-hub-e2e/README.md`, `apps/local-hub-e2e/playwright.config.ts`, `docker-compose.local-hub-e2e.yaml`; inspect actual coverage during approved delivery slices. | S9/S10 |

| Slice | Capability owned from this ledger |
|---|---|
| S0 | This inventory; provenance gap review; POC adapter/token/route census; target owner/service and schema ADR; read-only Community census if available; source-rights/privacy/quality reviewers. |
| S1 | Directory API/worker packaging, migrations, persistence/config/readiness, Redis/PostGIS dependency, topology and permission boundary. |
| S2 | Community UUID mapping, eligible-town contract, geometry/regions, privacy/app-scope and locality lifecycle. |
| S3 | New/existing Community backfill/onboarding, repair/reconciliation, durable queue/idempotency/cancel/resume and outbox. |
| S4 | Provider adapters, source rights/field lineage, Overture release/checkpoint/taxonomy/quality gates, optional Geoapify and AllThePlaces policies, provenance/publication withdrawal. |
| S5 | Public directory search/map/detail/regions API, contract/client, safe public payload and owner-managed page linking. |
| S6 | Shared public Town Square directory UI and app routes, maps, evidence, empty states, accessibility and attribution. |
| S7 | Restricted operator run, review/undo, rights/taxonomy correction and audit workflows; identity/role permissions. |
| S8 | Export queue/status/artifacts, independent export rights, restrictions, retention and deletion. |
| S9 | Deployment, health/readiness, observability, queue recovery, backups, cost/runtime controls and rollback proof. |
| S10 | Integrated acceptance and source-feature coverage scorecard; every capability either evidenced or explicitly dispositioned with approved rationale. |

**Decisions still open (block S0 approval/automation signoff):** (1) named platform, Social, security, source-rights and privacy/quality reviewers; (2) exact directory API/worker ownership, Nx project names/paths, database/schema, queue namespace and gateway route; (3) eligible Community predicate, geometry fallback/update/privacy rules, existing non-seed-town census and seed reconciliation; (4) operator identity/roles and listener/auth boundary; (5) provider-by-provider terms, field policies, live adapter availability and fixture fail-closed mode; (6) refresh/completeness/quality SLOs, cost ceiling and paid-call controls; (7) ownership/linkage rules for existing business pages and entitlement separation; (8) export grant, artifact download/expiry/withdrawal; (9) retention, audit and deletion semantics; (10) source snapshot/reconstructability, full dirty/untracked/ignored artifact review and any permitted transfer protocol; (11) all repair/replay tools’ exact dispositions; (12) release-readiness register relationship and claim classification. No operator, provider or data action is authorized by this ledger.

## S0 evidence gaps and stop conditions

- The cited source manifest is a selected-path hash inventory, not a full snapshot; its ignored/generated/data exclusions are unresolved. The whole POC content tree was not semantically reviewed and untracked data/artifact payloads were not opened. Do not call this a complete working-tree census.
- Staged/unstaged diffs were hashed but not retained in the cited manifest. A per-path hash list covers selected safe source/test/docs only. A reconstructable snapshot and immediate pre-import recheck are absent.
- The read-only, paginated Community census (privacy, app scope, geometry, duplicates, non-seed towns, seed comparison) is not evidenced here; mark pending if database access is unavailable.
- Controller code has no visible app-level authentication/authorization enforcement. Network separation probes do not replace target identity and permission checks.
- Source/provider legal terms, source artifact lineage, data quality, field lineage and export rights are not decided by this code inventory.
- POC-only four-seat/Waycross assumptions, default local credentials, staged data paths and fixture fallback must be removed or guarded in target production decisions.
- `AppController` scaffold and ignored/generated deployment artifacts need bounded confirmation if they are in another executable entrypoint; no database migrations, provider calls or UI/runtime verification were run as part of this read-only inventory.

Acceptance still requires human approval under the integration plan. Until then this ledger is an implementation map with explicit unknowns, not an authorization or completeness certification.
