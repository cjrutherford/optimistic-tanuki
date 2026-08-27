# HAI Landing Page Variant Adoption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the common-ui tone/emphasis/size contract across the HAI landing page while preserving its editorial layout, motion effects, navigation semantics, and brand-led visual hierarchy.

**Architecture:** Use `otui-button`, `otui-card`, and `otui-badge` where their native semantics fit. Keep native anchors for ecosystem navigation and add the canonical `data-tone`, `data-emphasis`, and `data-size` attributes to those link surfaces. Keep section layout and typography in HAI styles, while common-ui owns personality-aware surface treatment. The existing `ContactFormComponent` remains responsible for its internal card and submit button.

**Tech Stack:** Angular standalone components, Nx, SCSS, `@optimistic-tanuki/common-ui`, `@optimistic-tanuki/theme-lib`, Jest.

---

### Task 1: Add common-ui primitives to the landing page component imports

**Files:**

- Modify: `apps/hai/src/app/components/landing/landing.component.ts`
- Test: `apps/hai/src/app/components/landing/landing.component.spec.ts`

**Step 1: Write the failing test**

Add assertions that the rendered landing page contains the planned primitive selectors for the hero CTA/signal and at least one migrated content surface, while retaining the existing motion elements.

**Step 2: Run test to verify it fails**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern=landing`

Expected: FAIL because the page currently renders native CTA/card markup and `LandingComponent` does not import common-ui primitives.

**Step 3: Write minimal implementation**

Import `ButtonComponent`, `CardComponent`, and `BadgeComponent` from `@optimistic-tanuki/common-ui`, then add them to the standalone component imports. Do not add unrelated primitives or modify motion components.

**Step 4: Run test to verify it passes**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern=landing`

Expected: PASS after the corresponding template migration begins.

### Task 2: Migrate the hero conversion surfaces

**Files:**

- Modify: `apps/hai/src/app/components/landing/landing.component.html`
- Modify: `apps/hai/src/app/components/landing/landing.component.scss`
- Test: `apps/hai/src/app/components/landing/landing.component.spec.ts`

**Step 1: Write the failing test**

Assert that the hero contains:

- `otui-button` with `data-tone="brand"`, `data-emphasis="solid"`, and `data-size="lg"` for “Start a Project”.
- `otui-button` with `data-tone="brand"`, `data-emphasis="outline"`, and `data-size="lg"` for “See the services”.
- `otui-card` for the “Built For” signal.
- `otui-badge` for the “Built For” label.

**Step 2: Run test to verify it fails**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern=landing`

Expected: FAIL because the hero uses native links and an `aside` card.

**Step 3: Write minimal implementation**

Replace the CTA anchors with `otui-button` components. Use `(action)` handlers that scroll to `#contact` and `#services` without changing the URL behavior unless the existing app convention requires anchor navigation. Use `tone="brand"`, `emphasis="solid|outline"`, `size="lg"`, and `useGradient` only on the primary CTA.

Replace the signal `aside` with `otui-card` using `CardVariant="default"`, `tone="brand"`, and `emphasis="soft"`. Render the label as a brand soft `otui-badge`; retain the list and operating-principle markup inside the card.

Remove only HAI background/border declarations that conflict with the card/button contract. Preserve grid placement, hero motion, typography, and responsive rules.

**Step 4: Run test to verify it passes**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern=landing`

Expected: PASS.

### Task 3: Migrate services, manifesto, infrastructure, and engagement surfaces

**Files:**

- Modify: `apps/hai/src/app/components/landing/services-section.component.ts`
- Modify: `apps/hai/src/app/components/landing/services-section.component.html`
- Modify: `apps/hai/src/app/components/landing/manifesto-section.component.ts`
- Modify: `apps/hai/src/app/components/landing/manifesto-section.component.html`
- Modify: `apps/hai/src/app/components/landing/personal-cloud-section.component.ts`
- Modify: `apps/hai/src/app/components/landing/personal-cloud-section.component.html`
- Modify: `apps/hai/src/app/components/landing/engagement-section.component.ts`
- Modify: `apps/hai/src/app/components/landing/engagement-section.component.html`
- Modify: corresponding `*.scss` files
- Test: corresponding `*.spec.ts` files

**Step 1: Write the failing tests**

For each section, assert that repeated surfaces render `otui-card` and semantic labels render `otui-badge` where applicable:

- Services lead: brand soft card; service pillars: neutral soft cards.
- Manifesto items: brand outline cards with brand/info badges.
- Infrastructure ownership card: neutral soft card inside a brand-led section.
- Engagement stages: brand outline cards with solid brand stage-number badges.

Assert existing headings, list content, IDs, and motion elements remain present.

**Step 2: Run tests to verify they fail**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern="(services|manifesto|personal-cloud|engagement)"`

Expected: FAIL because these sections currently use native articles and spans.

**Step 3: Write minimal implementation**

Add `CardComponent` and `BadgeComponent` to each standalone section’s imports. Replace only surface elements with primitives, passing explicit canonical inputs. Keep `article` content, list semantics, IDs, and motion elements intact inside the card templates. Use `CardVariant="default"` for contract participation.

Update section SCSS so layout selectors target the primitive hosts (`otui-card`) without relying on removed native article classes. Preserve spacing and typography; remove duplicate background, border, radius, and shadow declarations where the common-ui contract now owns them.

**Step 4: Run tests to verify they pass**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern="(services|manifesto|personal-cloud|engagement)"`

Expected: PASS.

### Task 4: Migrate partner and ecosystem surfaces without breaking links

**Files:**

- Modify: `apps/hai/src/app/components/landing/partner-section.component.ts`
- Modify: `apps/hai/src/app/components/landing/partner-section.component.html`
- Modify: `apps/hai/src/app/components/landing/ecosystem-section.component.ts`
- Modify: `apps/hai/src/app/components/landing/ecosystem-section.component.html`
- Modify: corresponding `*.scss` files
- Test: corresponding `*.spec.ts` files

**Step 1: Write the failing tests**

Assert that:

- Partner benefits remain an accessible list and are rendered in variant-aware card/badge surfaces.
- Ecosystem items remain actual `<a>` elements with their original `href` values and link text.
- Ecosystem anchors expose canonical tone/emphasis attributes, with the first item receiving the stronger brand treatment.

**Step 2: Run tests to verify they fail**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern="(partner|ecosystem)"`

Expected: FAIL because these sections currently use only native panel/card classes.

**Step 3: Write minimal implementation**

Use `CardComponent` for partner content where no link semantics are needed. Keep ecosystem cards as native anchors, adding `data-tone`, `data-emphasis`, and `data-size` directly to the anchors. Add a local HAI selector for anchor-card presentation using the same live theme tokens and personality variables, without nesting interactive primitives.

**Step 4: Run tests to verify they pass**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern="(partner|ecosystem)"`

Expected: PASS.

### Task 5: Migrate the contact shell and preserve the existing form primitive

**Files:**

- Modify: `apps/hai/src/app/components/landing/contact-section.component.ts`
- Modify: `apps/hai/src/app/components/landing/contact-section.component.html`
- Modify: `apps/hai/src/app/components/landing/contact-section.component.scss`
- Test: `apps/hai/src/app/components/landing/contact-section.component.spec.ts`

**Step 1: Write the failing test**

Assert that the contact section has the brand-led surface contract and still renders `lib-contact-form`, its title, subjects, status, and submit event wiring.

**Step 2: Run test to verify it fails**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern=contact-section`

Expected: FAIL because the wrapper currently has only native section styling.

**Step 3: Write minimal implementation**

Use a common-ui card or contract-aware section wrapper for the brand-led shell, but do not replace `ContactFormComponent`. Keep its internal `ButtonComponent` and `CardComponent` ownership intact. Ensure the submit event and status rendering remain unchanged.

**Step 4: Run test to verify it passes**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern=contact-section`

Expected: PASS.

### Task 6: Remove conflicting HAI surface rules and add responsive contract coverage

**Files:**

- Modify: all touched HAI landing `*.scss` files
- Test: `apps/hai/src/app/components/landing/landing.component.spec.ts`

**Step 1: Write the failing test**

Add assertions for canonical data attributes across representative surfaces and verify the mobile layout still has the hero actions, service cards, engagement stages, ecosystem links, and contact form present.

**Step 2: Run test to verify it fails**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern=landing`

Expected: FAIL until all migrated surfaces expose the contract consistently.

**Step 3: Write minimal implementation**

Remove duplicate HAI background/border/radius/shadow rules that override common-ui variant output. Keep structural styles, text contrast adjustments, motion layers, focus-visible states, and responsive breakpoints. Ensure native ecosystem anchors retain a visible focus ring and hover state.

**Step 4: Run test to verify it passes**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai --testPathPattern=landing`

Expected: PASS.

### Task 7: Full verification

**Files:**

- No additional files expected.

**Step 1: Run focused tests**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai`

Expected: All HAI tests pass.

**Step 2: Run lint**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx lint hai`

Expected: No errors.

**Step 3: Run the repository development build**

Run: `npm run build:dev`

Expected: All configured development builds pass. Existing unrelated warnings may remain, but no Angular, TypeScript, or Sass errors may be introduced.

**Step 4: Review the final diff**

Run: `git diff --check` and inspect `git diff -- apps/hai libs/common-ui`.

Expected: No whitespace errors, no unrelated generated-file edits, and all landing-page surfaces use the approved variant hierarchy.
