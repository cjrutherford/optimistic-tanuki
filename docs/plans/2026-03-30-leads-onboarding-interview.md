# Leads Onboarding Interview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace manual first-run topic setup with an interview-style onboarding flow that learns what the user sells, who buys it, and where they can work locally, then configures `leads-app` and `lead-tracker` accordingly.

**Architecture:** Keep lead discovery topic-driven, but introduce an explicit onboarding interview layer that produces recommended topic presets and local search settings. Put interview orchestration in `leads-app`, add a small shared planning contract in `libs/models`, and teach `lead-tracker` to accept and persist richer topic presets consistently.

**Tech Stack:** Angular standalone app, NestJS microservice, Nx monorepo, TypeORM, Jest, Angular compiler, webpack/Nx build pipeline.

---

### Task 1: Document the onboarding interview contract before touching behavior

**Files:**
- Create: `libs/models/src/lib/libs/leads/onboarding-plan.interface.ts`
- Modify: `libs/models/src/lib/libs/leads/contracts.ts`
- Modify: `libs/models/src/index.ts`
- Test: `apps/leads-app/src/app/dashboard.component.spec.ts`

**Step 1: Write the failing test**

Add a spec that asserts the dashboard can render or consume an onboarding plan shape containing:

```typescript
{
  profile: {
    service: 'React modernization',
    audiences: ['SaaS teams', 'agencies'],
    outcomes: ['dashboard rebuilds', 'migration work'],
    opportunityMode: 'both',
    localMarkets: ['Savannah, GA', 'Charleston, SC'],
    excludedTerms: ['wordpress', 'php'],
  },
  topics: [
    {
      name: 'React modernization roles',
      discoveryIntent: 'job-openings',
      sources: ['remoteok', 'himalayas'],
    },
  ],
}
```

**Step 2: Run test to verify it fails**

Run: `npx jest apps/leads-app/src/app/dashboard.component.spec.ts --runInBand`
Expected: FAIL because the shared onboarding plan contract does not exist.

**Step 3: Write minimal implementation**

Create a shared interface for:

- interview profile fields
- generated topic presets
- optional recommendation notes for UI preview

Keep it interface-only at this stage.

**Step 4: Run test to verify it passes**

Run: `npx jest apps/leads-app/src/app/dashboard.component.spec.ts --runInBand`
Expected: PASS for contract usage.

**Step 5: Commit**

```bash
git add libs/models/src/lib/libs/leads/onboarding-plan.interface.ts libs/models/src/lib/libs/leads/contracts.ts libs/models/src/index.ts apps/leads-app/src/app/dashboard.component.spec.ts
git commit -m "feat: add leads onboarding planning contract"
```

### Task 2: Add a pure planner in `leads-app` that turns interview answers into topic presets

**Files:**
- Create: `apps/leads-app/src/app/onboarding-planner.ts`
- Create: `apps/leads-app/src/app/onboarding-planner.spec.ts`
- Modify: `apps/leads-app/src/app/leads.types.ts`
- Test: `apps/leads-app/src/app/onboarding-planner.spec.ts`

**Step 1: Write the failing test**

Create planner tests for:

- `jobs` mode creates only a remote-role topic
- `buyers` mode creates only a local-buyer topic
- `both` mode creates both topics
- local buyer topics require `localMarkets`
- audience strings are converted into Google Maps business types
- excluded terms are normalized and deduplicated

Example:

```typescript
it('creates remote and local topics from a both-mode interview', () => {
  const plan = buildOnboardingPlan({
    service: 'React modernization',
    audiences: ['SaaS teams', 'agencies'],
    outcomes: ['dashboard rebuilds'],
    opportunityMode: 'both',
    localMarkets: ['Savannah, GA'],
    excludedTerms: ['WordPress', 'wordpress'],
  });

  expect(plan.topics).toHaveLength(2);
  expect(plan.topics[0].discoveryIntent).toBe('job-openings');
  expect(plan.topics[1].discoveryIntent).toBe('service-buyers');
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest apps/leads-app/src/app/onboarding-planner.spec.ts --runInBand`
Expected: FAIL because planner does not exist.

**Step 3: Write minimal implementation**

Implement a pure planner function that:

- normalizes service, audience, outcome, and excluded term inputs
- picks default source bundles
- derives `googleMapsCities`
- maps common audience phrases to business types
- returns preview-ready topic presets without calling the API

Recommendation:
- Keep this logic pure and framework-free so it is easy to test and later reuse in `lead-tracker` if needed.

**Step 4: Run test to verify it passes**

Run: `npx jest apps/leads-app/src/app/onboarding-planner.spec.ts --runInBand`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/leads-app/src/app/onboarding-planner.ts apps/leads-app/src/app/onboarding-planner.spec.ts apps/leads-app/src/app/leads.types.ts
git commit -m "feat: add leads onboarding planner"
```

### Task 3: Replace dashboard first-run topic creation with an interview UI

**Files:**
- Modify: `apps/leads-app/src/app/dashboard.component.ts`
- Modify: `apps/leads-app/src/app/dashboard.component.html`
- Modify: `apps/leads-app/src/app/dashboard.component.scss`
- Modify: `apps/leads-app/src/app/dashboard.component.spec.ts`
- Test: `apps/leads-app/src/app/dashboard.component.spec.ts`

**Step 1: Write the failing test**

Add dashboard tests covering:

- fresh workspace opens onboarding interview
- interview fields bind correctly
- preview reflects generated topics
- local-only modes show a validation error if no local markets are entered
- submit creates topics from planner output instead of raw form fields

**Step 2: Run test to verify it fails**

Run: `npx jest apps/leads-app/src/app/dashboard.component.spec.ts --runInBand`
Expected: FAIL because dashboard still uses a manual topic form.

**Step 3: Write minimal implementation**

Update the dashboard to:

- replace `onboardingTopic` with structured interview state
- call the pure planner for preview generation
- submit the generated topics to `LeadsService.createTopic`
- present a clearer interview UX with strong preview states

Do not add topic-editing complexity here; only first-run onboarding belongs on the dashboard.

**Step 4: Run test to verify it passes**

Run: `npx jest apps/leads-app/src/app/dashboard.component.spec.ts --runInBand`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/leads-app/src/app/dashboard.component.ts apps/leads-app/src/app/dashboard.component.html apps/leads-app/src/app/dashboard.component.scss apps/leads-app/src/app/dashboard.component.spec.ts
git commit -m "feat: add interview-based leads onboarding"
```

### Task 4: Reposition the Topics page as refinement, not first-run setup

**Files:**
- Modify: `apps/leads-app/src/app/topics.component.ts`
- Modify: `apps/leads-app/src/app/topics.component.html`
- Modify: `apps/leads-app/src/app/topics.component.scss`
- Modify: `apps/leads-app/src/app/topics.component.spec.ts`
- Test: `apps/leads-app/src/app/topics.component.spec.ts`

**Step 1: Write the failing test**

Add tests asserting:

- the page points users back to the dashboard interview
- topic cards explain whether they are role-search or buyer-search topics
- local search configuration is summarized in a readable way

**Step 2: Run test to verify it fails**

Run: `npx jest apps/leads-app/src/app/topics.component.spec.ts --runInBand`
Expected: FAIL because the current page does not frame itself as a refinement step.

**Step 3: Write minimal implementation**

Add:

- a guidance banner linking back to dashboard onboarding
- topic strategy summaries
- clearer intent and Google Maps summaries

Keep manual add/edit available for advanced users.

**Step 4: Run test to verify it passes**

Run: `npx jest apps/leads-app/src/app/topics.component.spec.ts --runInBand`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/leads-app/src/app/topics.component.ts apps/leads-app/src/app/topics.component.html apps/leads-app/src/app/topics.component.scss apps/leads-app/src/app/topics.component.spec.ts
git commit -m "feat: reposition topics page as onboarding refinement"
```

### Task 5: Add backend normalization rules that match the planner output

**Files:**
- Modify: `apps/lead-tracker/src/app/leads.service.ts`
- Modify: `apps/lead-tracker/src/app/leads.service.spec.ts`
- Modify: `libs/models/src/lib/libs/leads/create-lead-topic.dto.ts`
- Modify: `libs/models/src/lib/libs/leads/update-lead-topic.dto.ts`
- Test: `apps/lead-tracker/src/app/leads.service.spec.ts`

**Step 1: Write the failing test**

Add service tests for:

- planner-generated topics are persisted with normalized `excludedTerms`
- Google Maps topics keep normalized `googleMapsCities` and `googleMapsTypes`
- empty optional arrays become `null` or defaults consistently

**Step 2: Run test to verify it fails**

Run: `npx jest apps/lead-tracker/src/app/leads.service.spec.ts --runInBand`
Expected: FAIL where normalization behavior is incomplete or inconsistent.

**Step 3: Write minimal implementation**

Ensure backend persistence:

- accepts planner-produced topic payloads without further UI assumptions
- keeps normalization rules centralized in `LeadsService`
- preserves backward compatibility for manual topic creation

**Step 4: Run test to verify it passes**

Run: `npx jest apps/lead-tracker/src/app/leads.service.spec.ts --runInBand`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/lead-tracker/src/app/leads.service.ts apps/lead-tracker/src/app/leads.service.spec.ts libs/models/src/lib/libs/leads/create-lead-topic.dto.ts libs/models/src/lib/libs/leads/update-lead-topic.dto.ts
git commit -m "feat: normalize onboarding-generated lead topics"
```

### Task 6: Make topic edits trigger rediscovery for all search-shaping fields

**Files:**
- Modify: `apps/lead-tracker/src/app/leads.controller.ts`
- Modify: `apps/lead-tracker/src/app/leads.controller.spec.ts`
- Test: `apps/lead-tracker/src/app/leads.controller.spec.ts`

**Step 1: Write the failing test**

Add tests covering rediscovery when:

- `excludedTerms` change
- `discoveryIntent` changes
- `sources` change
- Google Maps cities/types change

**Step 2: Run test to verify it fails**

Run: `npx jest apps/lead-tracker/src/app/leads.controller.spec.ts --runInBand`
Expected: FAIL for fields not currently treated as rediscovery triggers.

**Step 3: Write minimal implementation**

Update `shouldRunDiscovery()` so any field that materially changes matching behavior requeues discovery for enabled topics.

**Step 4: Run test to verify it passes**

Run: `npx jest apps/lead-tracker/src/app/leads.controller.spec.ts --runInBand`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/lead-tracker/src/app/leads.controller.ts apps/lead-tracker/src/app/leads.controller.spec.ts
git commit -m "feat: rerun discovery when topic search strategy changes"
```

### Task 7: Add current documentation for the onboarding-driven model

**Files:**
- Create: `apps/lead-tracker/documentation.lwts`
- Modify: `docs/plans/leed-tracker.md`

**Step 1: Write the failing test**

No automated test. Create a manual documentation checklist:

- current onboarding flow documented
- source-of-truth files listed
- topic generation rules described
- historical plan clearly marked as non-canonical

**Step 2: Run test to verify it fails**

Manual inspection of existing docs.
Expected: FAIL because older docs describe a more manual or outdated setup.

**Step 3: Write minimal implementation**

Add a concise current-state doc describing:

- interview-driven onboarding
- generated topic bundles
- backend normalization and rediscovery expectations

Turn the older plan into a pointer, not the canonical doc.

**Step 4: Run test to verify it passes**

Manual check of both files.
Expected: Canonical current doc exists and the old plan is clearly historical.

**Step 5: Commit**

```bash
git add apps/lead-tracker/documentation.lwts docs/plans/leed-tracker.md
git commit -m "docs: add current lead tracker onboarding documentation"
```

### Task 8: Verify the end-to-end build and test surface

**Files:**
- Modify: none unless failures are found
- Test: `apps/leads-app/src/app/dashboard.component.spec.ts`
- Test: `apps/leads-app/src/app/topics.component.spec.ts`
- Test: `apps/lead-tracker/src/app/leads.controller.spec.ts`
- Test: `apps/lead-tracker/src/app/leads.service.spec.ts`

**Step 1: Write the failing test**

No new test. This task validates the previous tasks together.

**Step 2: Run test to verify it fails**

Run:

```bash
npx jest apps/leads-app/src/app/dashboard.component.spec.ts --runInBand
npx jest apps/leads-app/src/app/topics.component.spec.ts --runInBand
npx jest apps/lead-tracker/src/app/leads.controller.spec.ts --runInBand
npx jest apps/lead-tracker/src/app/leads.service.spec.ts --runInBand
npx tsc -p apps/leads-app/tsconfig.app.json --noEmit
npx tsc -p apps/lead-tracker/tsconfig.app.json --noEmit
npm run build:dev
```

Expected: any remaining issues surface here.

**Step 3: Write minimal implementation**

Fix only build/test regressions discovered during verification.

**Step 4: Run test to verify it passes**

Re-run the same commands until:

- dashboard onboarding tests pass
- topics refinement tests pass
- lead-tracker controller/service tests pass
- app TypeScript compiles
- `npm run build:dev` succeeds

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify leads onboarding interview integration"
```

## Notes

- Recommendation: keep the interview planner in the frontend first. It is simpler, testable, and does not require a new backend onboarding endpoint.
- If multiple clients will need the same onboarding logic later, move the pure planner into `libs/models` or a new shared `libs/leads-domain` package after the first implementation stabilizes.
- Do not overload the dashboard with manual topic editing. The interview should feel opinionated and fast.
