# S014 — Analytics and Campaign Tracking

## Status

Complete

## Objective

Add privacy-conscious analytics events and UTM handling.

## Why this slice exists

Print and web campaigns need attribution and funnel visibility.

## Dependencies

S013

## In scope

- CTA events
- assessment start/submit
- audience selection
- UTM persistence
- phone/email clicks

## Out of scope

- Behavioral profiling
- invasive tracking

## Required References

- ../06-SEO-ANALYTICS-ACCESSIBILITY.md

## Implementation Requirements

- Reuse existing analytics if present.

## Acceptance Criteria

- [x] Required events fire once
- [x] UTM values persist as designed
- [x] No unnecessary personal data collected

## Validation

- Analytics debug/test environment validation.

## Expected Files / Areas

- analytics integration
- CTA handlers

## Completion Notes

Completed 2026-10-07.

No event analytics existed to reuse (HAI only beacons Web Vitals to
`/api/performance/rum`), so this adds a first-party, aggregate-only path
modelled on that telemetry.

**Gateway** (`apps/gateway/src/analytics/`): public `POST
/api/analytics/events` increments in-memory counters keyed by app, event,
path, an optional fixed detail, and UTM source/medium/campaign. It stores no
IP, user agent, identifier, or per-event timestamp, accepts only seven event
names, clean paths without query strings, slug-only detail and UTM values,
and caps distinct counters at 5,000. `GET /api/analytics/summary` requires
`security.observability.read`, like the performance summary. Counts reset on
restart.

**Site** (`services/analytics.service.ts`), started from the app shell in the
browser only:

| Event                        | When                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `page_view`                  | each navigation (covers private-cloud landing and OSS stack visits)                   |
| `cta_click`                  | links to `/private-cloud/assessment` or `/contact` (detail: `assessment` / `contact`) |
| `audience_interest`          | links to the home or organizations page (detail: `home` / `organization`)             |
| `assessment_start`           | first interaction with the form, once per visit to the page                           |
| `assessment_submit`          | successful submission, once (detail: audience)                                        |
| `phone_click`, `email_click` | `tel:` / `mailto:` links (the number and address are not sent)                        |

UTM design: `utm_source`, `utm_medium`, and `utm_campaign` are read from the
landing URL, lower-cased, kept only if they are short slugs, and stored in
`sessionStorage` for the session (a newer valid campaign replaces it). Every
event carries them, and contact and assessment submissions append them to
`sourcePage` for lead attribution. Other `utm_*` keys are ignored.

Privacy: no cookies or identifiers; events carry no free text or personal
data; Global Privacy Control or Do Not Track sends nothing (submissions still
work).

Validation:

- Unit: HAI 207 tests (analytics: one page view per navigation and none on
  start, no query or personal data in paths, campaign cleaning and
  persistence, click classification without phone or email values,
  once-only events, DNT/GPC). Gateway 1,476 tests (aggregation, nothing
  about the visitor stored, rejection of unknown events, query strings,
  free text, emails in UTM, oversized values, the key cap, and acceptance
  of every event the site sends).
- Debug environment: the production build against a stub gateway, replaying
  a print-campaign journey (`/private-cloud?utm_source=print&utm_medium=
flyer&utm_campaign=private_cloud` → home path → assessment → submit →
  phone → email). The stub recorded exactly one of each event in order, all
  carrying the campaign, and the lead's `sourcePage` was
  `/private-cloud/assessment?utm_source=print&utm_medium=flyer&
utm_campaign=private_cloud`. With Global Privacy Control on, zero events
  were sent and the submission still went through.
- `nx lint` and `nx build` for `hai` and `gateway`: pass.

Fixed during validation: a spurious first `page_view` for `/` (start ran
before the initial navigation finished); page views now come only from
`NavigationEnd`.

Changed files:

- `apps/gateway/src/analytics/` (new service, controller, spec),
  `apps/gateway/src/app/app.module.ts`
- `apps/hai/src/app/services/analytics.service{,.spec}.ts` (new)
- `apps/hai/src/app/app.component{,.spec}.ts`
- `apps/hai/src/app/services/{contact,assessment}-request.service{,.spec}.ts`
- `apps/hai/src/app/components/assessment/assessment-form.component.{ts,html}`
- `docs/plans/hai-private-cloud/` (this slice, README, new S020)

### Revision 2026-10-07: persistent counts on the existing analytics surface

At the owner's direction, counts must survive a gateway reboot and should use
the analytics surface already in the repository: Prometheus scrapes the
gateway's `/api/performance/prometheus` endpoint (90-day retention on a
persistent volume) and Grafana dashboards are provisioned from ConfigMaps.

- Counters now live in Redis (`ot:site-analytics:counts`, one hash shared by
  all gateway replicas) whenever `REDIS_HOST` is set, which it is in compose
  and Kubernetes; local runs without Redis fall back to memory.
  (`apps/gateway/src/analytics/site-analytics.store.ts`)
- The performance exposition endpoint now also emits
  `ot_site_events_total{app,event,path,detail,utm_source,utm_medium,
utm_campaign}`; a store outage cannot take the performance metrics down.
- New Grafana dashboard "HAI site analytics"
  (`k8s/base/observability/site-analytics.yaml`, mounted in `grafana.yaml`):
  landing, OSS stack, assessment start/submit, phone and email totals; home
  vs organization interest; page views; calls to action; campaigns; events
  per hour. Queries take `max` across instances because every replica
  exposes the same Redis totals.
- Event recording fails open: a store outage returns `{accepted: false}`
  rather than an error; invalid events are still rejected.
- Verified: store tests show counts surviving a simulated restart and adding
  up across replicas; the real node-redis 5 client against a real Redis 7
  server carried a count from 1 to 2 across two processes; `kubectl
kustomize k8s/base/observability` builds; gateway 1,482 tests, lint, and
  build pass.

## Deviations / Blockers

- Compose's `redis` service has no volume, so counts survive gateway and
  Redis restarts but not `docker compose down` (or anything that recreates
  the Redis container). Recommended: add a named volume at `/data` for the
  `redis` service. Not changed here, since it affects every service using
  that Redis.
- Prometheus and Grafana are defined only for Kubernetes. Until there is a
  cluster, counts are readable through `GET /api/analytics/summary`
  (requires `security.observability.read`).
- The PromQL in the dashboard was reviewed but not executed against a live
  Prometheus.
