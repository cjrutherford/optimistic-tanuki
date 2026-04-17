# Lead Discovery Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize broken discovery providers in `apps/lead-tracker`, make Google Maps discovery reliably match local-service opportunities, add topic-level negative term blocklists, and introduce a separate discovery intent for companies likely to buy services instead of posting jobs.

**Architecture:** Treat this as two layers. First, harden provider ingestion so third-party failures produce structured warnings instead of JSON parse crashes. Second, extend the topic model with explicit discovery intent and exclusion terms so job-feed matching and service-buyer matching use different rules without overloading the same keyword-only behavior.

**Tech Stack:** NestJS microservice, Angular standalone app, TypeORM/Postgres, Jest/Nx.

---

## Confirmed Root Causes

- `apps/lead-tracker/src/app/discovery/himalayas-discovery.provider.ts` calls `response.json()` on `https://himalayas.app/api/jobs`, but the live endpoint currently returns `HTTP 404` with `content-type: text/html` and a body beginning with `<!DOCTYPE html>`.
- `apps/lead-tracker/src/app/discovery/jobicy-discovery.provider.ts` also calls `response.json()` without checking `response.ok` or `content-type`. Jobicy is returning JSON now, so the observed `<!DOCTYPE html>` failure is likely intermittent upstream HTML, bot/challenge behavior, or another non-JSON error page.
- `apps/lead-tracker/src/app/discovery/google-maps-discovery.provider.ts` only matches on `place.name + formatted_address + query`. That is too weak for “find companies that need my services” because most businesses will not contain topical terms like `react`, `wordpress`, or `php` in their place name or address.
- `libs/models/src/lib/libs/leads/lead-topic.model.ts` and the topic DTOs do not support exclusion terms or a discovery intent field, so there is nowhere to persist “blocklist wordpress/php” or “this topic is searching for service buyers rather than jobs”.

### Task 1: Add Regression Coverage For Current Failures

**Files:**
- Modify: `apps/lead-tracker/src/app/discovery.service.spec.ts`
- Create: `apps/lead-tracker/src/app/discovery/himalayas-discovery.provider.spec.ts`
- Create: `apps/lead-tracker/src/app/discovery/jobicy-discovery.provider.spec.ts`
- Create: `apps/lead-tracker/src/app/discovery/google-maps-discovery.provider.spec.ts`
- Modify: `apps/leads-app/src/app/topics.component.spec.ts`
- Modify: `apps/leads-app/src/app/leads.service.spec.ts`

**Step 1: Write the failing backend tests**

Add provider-level tests that prove:
- Himalayas returns a warning, not an exception, when the upstream responds with HTML/404.
- Jobicy returns a warning, not an exception, when the upstream responds with HTML or a non-OK status.
- Google Maps can retain a candidate when the query intent is “service buyer” even if topic keywords are absent from the place name.
- Discovery filtering drops candidates containing excluded terms like `wordpress` or `php`.

**Step 2: Run backend tests to verify failure**

Run: `npx nx test lead-tracker --runInBand`

Expected: provider tests fail because the providers parse JSON unconditionally and the topic model has no blocklist/intent behavior.

**Step 3: Write the failing frontend tests**

Add Angular tests that prove:
- topic create/update payloads include `excludedTerms` and `discoveryIntent`
- the form validates Google Maps settings differently for service-buyer topics
- the edit form round-trips the new fields

**Step 4: Run frontend tests to verify failure**

Run: `npx nx test leads-app --runInBand`

Expected: form and service tests fail because the new fields do not exist yet.

**Step 5: Commit**

```bash
git add apps/lead-tracker/src/app/discovery/*.spec.ts apps/lead-tracker/src/app/discovery.service.spec.ts apps/leads-app/src/app/topics.component.spec.ts apps/leads-app/src/app/leads.service.spec.ts
git commit -m "test: add lead discovery regression coverage"
```

### Task 2: Harden Third-Party Provider Fetching

**Files:**
- Create: `apps/lead-tracker/src/app/discovery/provider-http.util.ts`
- Modify: `apps/lead-tracker/src/app/discovery/himalayas-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/jobicy-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/google-maps-discovery.provider.ts`

**Step 1: Write the failing helper-focused tests**

Add tests for a small shared helper that:
- checks `response.ok`
- checks `content-type` for JSON
- reads a short body preview
- returns a typed warning like `Expected JSON but received text/html`

**Step 2: Run the targeted test to verify failure**

Run: `npx jest apps/lead-tracker/src/app/discovery/himalayas-discovery.provider.spec.ts --runInBand`

Expected: failure because the provider still calls `response.json()` directly.

**Step 3: Write minimal implementation**

Implement a shared fetch/read helper used by Himalayas, Jobicy, and Google Maps so every provider:
- handles `!response.ok`
- rejects non-JSON responses before parsing
- includes status code and content-type in warnings
- includes a short preview for HTML responses

For Himalayas specifically, treat the current endpoint as unavailable and return a deterministic warning instead of attempting normal parsing when the endpoint responds with HTML/404.

**Step 4: Run tests to verify pass**

Run: `npx nx test lead-tracker --runInBand`

Expected: provider tests pass and discovery produces warnings instead of parser crashes.

**Step 5: Commit**

```bash
git add apps/lead-tracker/src/app/discovery/provider-http.util.ts apps/lead-tracker/src/app/discovery/himalayas-discovery.provider.ts apps/lead-tracker/src/app/discovery/jobicy-discovery.provider.ts apps/lead-tracker/src/app/discovery/google-maps-discovery.provider.ts
git commit -m "fix: harden discovery provider response handling"
```

### Task 3: Add Topic Excluded Terms And Discovery Intent

**Files:**
- Modify: `libs/models/src/lib/libs/leads/lead-topic.model.ts`
- Create: `libs/models/src/lib/libs/leads/lead-topic-discovery-intent.enum.ts`
- Modify: `libs/models/src/lib/libs/leads/create-lead-topic.dto.ts`
- Modify: `libs/models/src/lib/libs/leads/update-lead-topic.dto.ts`
- Modify: `libs/models/src/lib/libs/leads/contracts.ts`
- Modify: `libs/models/src/lib/libs/leads/index.ts`
- Modify: `apps/lead-tracker/src/app/leads.service.ts`
- Modify: `apps/leads-app/src/app/leads.types.ts`
- Create: `apps/lead-tracker/migrations/2026033000000-add-topic-intent-and-excluded-terms.ts`

**Step 1: Write the failing model/service tests**

Add tests that prove:
- `excludedTerms` are normalized, deduplicated, and saved
- `discoveryIntent` defaults to a job-oriented value for existing topics
- disabling Google Maps clears only Google Maps-specific inputs, not the new generic topic metadata

**Step 2: Run targeted tests to verify failure**

Run: `npx jest apps/lead-tracker/src/app/leads.service.spec.ts --runInBand`

Expected: failure because DTOs/entities do not expose the new fields.

**Step 3: Write minimal implementation**

Add:
- `excludedTerms: string[]`
- `discoveryIntent: 'job-openings' | 'service-buyers'`

Normalize them in `LeadsService` the same way sources and Google Maps lists are normalized. Add a migration that backfills existing rows to `job-openings` and `{}`.

**Step 4: Run tests to verify pass**

Run: `npx nx test lead-tracker --runInBand`

Expected: model and service tests pass.

**Step 5: Commit**

```bash
git add libs/models/src/lib/libs/leads apps/lead-tracker/src/app/leads.service.ts apps/lead-tracker/migrations/2026033000000-add-topic-intent-and-excluded-terms.ts
git commit -m "feat: add topic discovery intent and excluded terms"
```

### Task 4: Make Google Maps Discovery Match Service-Buyer Topics

**Files:**
- Modify: `apps/lead-tracker/src/app/discovery/google-maps-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/discovery.types.ts`
- Modify: `apps/lead-tracker/src/app/discovery/provider-result-analysis.util.ts`
- Modify: `apps/lead-tracker/src/app/discovery.service.ts`

**Step 1: Write the failing behavior test**

Add a test with a topic such as:
- `discoveryIntent = service-buyers`
- `googleMapsTypes = ['dental office']`
- `excludedTerms = ['wordpress', 'php']`

Expected behavior:
- a business returned from Google Maps is eligible based on business type + local query context
- a result whose name/query/notes includes `wordpress` or `php` is rejected

**Step 2: Run targeted tests to verify failure**

Run: `npx jest apps/lead-tracker/src/app/discovery/google-maps-discovery.provider.spec.ts --runInBand`

Expected: failure because the provider still requires positive keyword matches from the topic terms.

**Step 3: Write minimal implementation**

Refactor Google Maps matching so:
- `job-openings` topics keep current keyword-driven behavior
- `service-buyers` topics treat the city/type query itself as a positive signal
- optional topic keywords still strengthen a match rather than acting as a hard gate
- `excludedTerms` are applied as a hard reject before candidate creation

Also include richer notes so the lead records preserve the exact city/type query that created the match.

**Step 4: Run tests to verify pass**

Run: `npx nx test lead-tracker --runInBand`

Expected: Google Maps tests pass and service-buyer topics produce candidates more reliably.

**Step 5: Commit**

```bash
git add apps/lead-tracker/src/app/discovery/google-maps-discovery.provider.ts apps/lead-tracker/src/app/discovery/discovery.types.ts apps/lead-tracker/src/app/discovery/provider-result-analysis.util.ts apps/lead-tracker/src/app/discovery.service.ts
git commit -m "feat: improve google maps service-buyer matching"
```

### Task 5: Apply Excluded-Term Filtering Across Discovery Providers

**Files:**
- Modify: `apps/lead-tracker/src/app/discovery/source-provider.util.ts`
- Modify: `apps/lead-tracker/src/app/discovery/himalayas-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/jobicy-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/remoteok-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/weworkremotely-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/justremote-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/clutch-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/crunchbase-discovery.provider.ts`
- Modify: `apps/lead-tracker/src/app/discovery/indeed-discovery.provider.ts`

**Step 1: Write the failing cross-provider tests**

Add one shared expectation per provider: if the candidate text contains an excluded term, it is not returned even when positive keywords match.

**Step 2: Run the tests to verify failure**

Run: `npx nx test lead-tracker --runInBand`

Expected: providers still return blocked results.

**Step 3: Write minimal implementation**

Add shared helpers for:
- normalized positive terms
- normalized excluded terms
- `hasExcludedTerms(text, excludedTerms)`

Use them consistently in every provider instead of duplicating ad hoc string matching.

**Step 4: Run tests to verify pass**

Run: `npx nx test lead-tracker --runInBand`

Expected: excluded terms are enforced uniformly.

**Step 5: Commit**

```bash
git add apps/lead-tracker/src/app/discovery
git commit -m "feat: enforce excluded terms across discovery providers"
```

### Task 6: Extend The Topics UI For Intent And Excluded Terms

**Files:**
- Modify: `apps/leads-app/src/app/leads.types.ts`
- Modify: `apps/leads-app/src/app/topics.component.ts`
- Modify: `apps/leads-app/src/app/topics.component.html`
- Modify: `apps/leads-app/src/app/topics.component.scss`
- Modify: `apps/leads-app/src/app/leads.service.ts`

**Step 1: Write the failing UI tests**

Add tests that prove:
- the form shows an intent control
- the form shows an excluded-terms input
- the payload includes the new fields on create/update
- the topic card displays the configured intent and exclusions

**Step 2: Run UI tests to verify failure**

Run: `npx nx test leads-app --runInBand`

Expected: failure because the form does not render or submit the new fields.

**Step 3: Write minimal implementation**

Update the topic form to:
- add a discovery intent selector
- add an excluded-terms comma-separated input
- keep Google Maps city/type inputs only when Google Maps is selected
- improve help text so “service buyers” explains that Google Maps will search for local businesses by category, not job postings

**Step 4: Run tests to verify pass**

Run: `npx nx test leads-app --runInBand`

Expected: form tests pass and payloads match backend expectations.

**Step 5: Commit**

```bash
git add apps/leads-app/src/app/leads.types.ts apps/leads-app/src/app/topics.component.ts apps/leads-app/src/app/topics.component.html apps/leads-app/src/app/topics.component.scss apps/leads-app/src/app/leads.service.ts
git commit -m "feat: add discovery intent and excluded terms to topics ui"
```

### Task 7: Verify End-To-End Discovery Diagnostics

**Files:**
- Modify: `apps/lead-tracker/src/app/discovery.service.ts`
- Modify: `apps/leads-app/src/app/topics.component.html`

**Step 1: Write the failing diagnostics test**

Add coverage that provider warnings surface enough detail to distinguish:
- dead endpoint
- non-JSON upstream response
- missing API key
- no matches after exclusions

**Step 2: Run tests to verify failure**

Run: `npx nx test lead-tracker --runInBand`

Expected: diagnostics are too generic.

**Step 3: Write minimal implementation**

Improve provider warnings and discovery result messaging so the UI can show actionable causes instead of generic “request failed” text.

**Step 4: Run full verification**

Run: `npx nx test lead-tracker --runInBand`

Run: `npx nx test leads-app --runInBand`

Expected: both suites pass.

**Step 5: Commit**

```bash
git add apps/lead-tracker/src/app/discovery.service.ts apps/leads-app/src/app/topics.component.html
git commit -m "chore: improve lead discovery diagnostics"
```

## Notes For Implementation

- Do not silently delete the `himalayas` source enum yet. Existing rows and UI state may still reference it. First stabilize behavior with explicit warnings, then decide later whether to retire the source.
- Keep `service-buyers` separate from the existing search-driven providers. `clutch` and `crunchbase` already act more like service-buyer acquisition than job-feed scraping, so this intent should guide matching rules, not duplicate provider lists.
- Prefer a shared provider helper over scattered `response.ok` checks so future providers inherit the same behavior.
- Preserve backward compatibility for existing topics by defaulting old rows to `job-openings`.

## Verification Checklist

- Creating or editing a topic with `excludedTerms: ['wordpress', 'php']` persists correctly.
- Himalayas no longer throws when the upstream returns HTML; it reports an explicit unavailable warning.
- Jobicy no longer throws on non-JSON upstream responses.
- Google Maps service-buyer topics can create leads even when the business name does not contain the topic keyword.
- Excluded terms remove otherwise-matching results across providers.
- The topics UI displays and submits intent plus excluded terms.
