---
title: Theme & Personality System — Improvement & Distinctiveness Plan
date: 2026-07-14
status: proposed
summary: Evidence-based plan to fix integrity bugs in the personality token system and enforce genuine, measurable distinctiveness across the 12 personalities.
---

# Theme & Personality System — Improvement & Distinctiveness Plan

## Context

The theme/design-system domain scored highest in the 2026-07-14 audit (7.5/10). The
personality system is real and substantial: 12 personalities in
`libs/theme-models/src/lib/personalities.ts` (2,056 lines), runtime switching in
`libs/theme-lib/.../theme.service.ts`, WCAG contrast enforcement, and Storybook
coverage. This plan does not relitigate that — it targets the specific weaknesses the
audit found (over-mocked tests) plus what a fresh, data-driven distinctiveness analysis
surfaced.

## What the distinctiveness analysis actually found

Method: the 12 personalities were transpiled and compared field-by-field across 26 token
dimensions (color harmony, spacing, radius, border, shadow, typography, animation,
color-generation, mobile). Pairwise perceptual distance was computed (0 = identical,
1 = maximally different). Raw data: `scripts/analyze-personality-distinctiveness` output.

**The good (keep, don't touch):**

- Mean pairwise distance is **0.608** — personalities are, on the whole, distinct.
- Body/heading fonts are genuinely varied: **11/12** unique body families
  (Cormorant Garamond, Fredoka, IBM Plex Mono, Work Sans, Space Grotesk, …).
- `presentation.shadow.value` is **11/12** unique; color-harmony numerics vary widely.
- `classic` vs `foundation` _looked_ close on raw distance (0.296) but a field-by-field
  read shows `foundation` is a legitimately separate identity — compact / sharp / fast /
  7:1 contrast / reduced-motion / technical. **Not a problem.** (This is why the raw
  metric alone is insufficient — see Workstream C.)

**The real problems:**

1. **Dual source of truth for fonts, and they disagree (highest impact).**
   `theme.service.ts` emits `--font-heading` from `personality.fonts.heading.family`
   (line 721) _and_ `--personality-font-family` from
   `personality.presentation.typography.familyValue` (line 747). For **6 of 12**
   personalities these disagree:

   | Personality  | `fonts.heading` | `presentation` font |
   | ------------ | --------------- | ------------------- |
   | classic      | system-ui       | Inter               |
   | minimal      | Inter           | Helvetica Neue      |
   | bold         | Poppins         | Inter               |
   | soft         | Quicksand       | Georgia             |
   | professional | Source Sans Pro | Roboto              |
   | playful      | Fredoka         | Poppins             |

   Components binding `--personality-font-family` render the generic family; components
   binding `--font-heading` render the curated one. Same personality, two typefaces,
   and the _distinctive_ curated fonts are silently overridden by generic ones wherever
   the presentation variable wins. This directly undercuts distinctiveness.

2. **One genuinely redundant pair: `soft` vs `soft-touch` (perceptual distance 0.189).**
   They differ across 27 fields, but _every delta is below the just-noticeable-difference
   threshold_: spacingMultiplier 1.4 vs 1.25, accentSaturation 45 vs 40, borderRadius
   1.5× vs 1.75×, animation 400ms vs 350ms, shadowTint primary-tint vs warm. Both are
   soft/rounded/warm/gentle with Quicksand headings and Nunito(Sans) body. A user cannot
   tell them apart. The docs' defense ("each personality differs in ≥4 dimensions",
   `docs/design-system/personalities.md:53`) is technically true and perceptually
   meaningless here. `soft-touch` is Towne Square's canonical default, so it needs a real
   identity, not a near-clone of `soft`.

3. **Structural token dimensions cluster on defaults — color & font do most of the work.**
   Unique-values-out-of-12: border-radius style **3**, border style **3**, shadow
   intensity **3**, animation speed **3**, spacing scale **4**. Five personalities each
   share `soft` radius, `thin` border, `subtle` shadow, `fast` animation. So several
   personalities differ mainly in hue and typeface while sharing the same spatial/
   structural "feel." Distinctiveness is thinner than the "adapts every token" claim
   implies.

4. **Fonts may not load at all.** The audit flagged the font-loading allowlist
   (`font-loading.service.ts:151-171`). If a curated family isn't loaded, it falls back to
   system-ui and the personality collapses toward `classic`/`foundation`. Distinctiveness
   on paper ≠ distinctiveness on screen.

5. **No test enforces distinctiveness or font consistency.** `personalities.spec.ts` only
   checks that presentation fields exist and hard-codes `bold`'s values. Nothing fails
   when two personalities drift into near-duplicates or when `fonts` and `presentation`
   disagree.

---

## Workstreams

### A. Fix token-system integrity (do first — prerequisites for real distinctiveness)

**A1. Unify the font source of truth.** Decide the canonical source (recommend:
`personality.fonts`, since it carries weights, mono, display/preload metadata and drives
font loading). Either derive `presentation.typography.familyValue` from `personality.fonts`
at build time, or remove the redundant `--personality-font-family` emission and have all
components bind `--font-heading`/`--font-body`. Delete the divergent hard-coded presentation
font strings. Touch: `libs/theme-models/.../personalities.ts`,
`libs/theme-lib/.../theme.service.ts:747`, `personality.interfaces.ts`.

**A2. Guarantee curated fonts actually load.** Replace the hard-coded allowlist with a
generated one derived from the personality registry (every `fonts.*.family` primary is
loadable), or validate at startup that each personality's families resolve. Add a dev
warning when a personality's font falls back. Touch:
`libs/theme-lib/.../font-loading.service.ts`.

**A3. Reconcile with the audit's separate theme item.** Fold in the integration-test gap
(A/B below) that the main audit already flagged for `setPersonality()`.

### B. Enforce genuine distinctiveness

**B1. Resolve `soft` vs `soft-touch`.** Two options — recommend option (a):

- (a) **Differentiate.** Keep `soft` as the airy/light gentle theme; push `soft-touch`
  toward a tactile, higher-contrast "warm paper" identity (heavier body weight, a serif or
  humanist-slab heading distinct from Quicksand, warmer neutral bias, slightly firmer
  shadows). Give Towne Square a personality that reads as its own, and lift the pair's
  perceptual distance above the threshold defined in C1.
- (b) Merge them and repoint Towne Square — only if product design decides two warm themes
  aren't worth maintaining.

**B2. Make structure carry differentiation.** Audit the personalities that share
radius/border/shadow/animation defaults and deliberately spread them so that at least
_three_ of {radius, border, shadow, spacing, animation} are non-default per personality.
Concretely: raise unique-value counts for border-radius, border, and shadow from 3/12
toward ~6/12. This is a design exercise, not a mechanical one — each change must serve the
personality's stated character (`tags`, `description`).

**B3. Keep it honest against products.** Re-run `assertProductPersonalitiesAreValid()`
context: the six product-mapped personalities (classic, soft-touch, bold, professional,
electric, architect) must remain the most mutually distinct, since they ship as product
identities.

### C. Make distinctiveness measurable and regression-proof

**C1. Perceptual distance metric + threshold, as a test.** Promote the analysis script to a
committed utility (`libs/theme-models/src/lib/personality-distinctiveness.ts`) that computes
pairwise perceptual distance using **JND-aware weighting** (categorical mismatches count
full; numeric deltas scale by perceptual salience, not raw range — so 400ms vs 350ms barely
registers). Add `personality-distinctiveness.spec.ts` asserting **no pair is below a chosen
threshold** (seed it just above the current `soft`/`soft-touch` value once B1 lands) and that
every product personality clears a higher bar.

**C2. Font-consistency test.** Fail if any personality's `fonts.heading` and
`presentation.typography.familyValue` disagree (prevents regression of A1).

**C3. Integration tests for `setPersonality()`.** Assert emitted CSS variables match the
selected personality (both font vars agree, radius/shadow/animation reflect tokens) — closes
the audit's "over-mocked theme tests" finding. Touch:
`libs/theme-lib/.../theme.service.spec.ts`.

### D. Documentation & visibility

**D1. Generate the distinctiveness matrix from code.** Replace the hand-maintained table in
`docs/design-system/personalities.md:55` with output from the C1 utility, and correct the
"differs in ≥4 dimensions" language to a perceptual claim ("no two personalities are within
JND threshold; product personalities exceed 2×").

**D2. Storybook "all 12 at a glance."** Add a story rendering the same primitives (button,
card, input, heading, body) across all 12 personalities in light and dark, so redundancy or
fallback is visible in review. (Also closes the audit's Storybook coverage suggestion — note
the earlier claim that personality stories were absent was refuted; `personality-showcase`
and `personality-preview` stories exist, but a normalized side-by-side grid does not.)

---

## Sequencing & effort

| Phase | Items      | Rationale                                                                    | Rough effort           |
| ----- | ---------- | ---------------------------------------------------------------------------- | ---------------------- |
| 1     | A1, A2, C2 | Fix font integrity so on-screen output matches the data; lock it with a test | ~1–1.5 days            |
| 2     | C1, C3     | Land the metric + integration tests so B changes are verifiable              | ~1.5 days              |
| 3     | B1, B2, B3 | The actual design work, now measurable against C1                            | ~2–3 days (design-led) |
| 4     | D1, D2     | Regenerate docs + Storybook from the now-trustworthy system                  | ~1 day                 |

Phases 1–2 are mechanical/testable and can proceed immediately. Phase 3 is design-led and
should involve whoever owns the product identities. Nothing here is destructive; all changes
are additive or reconciling.

## Success criteria

- Zero personalities with disagreeing font sources (test-enforced).
- No personality pair below the JND distinctiveness threshold; product personalities ≥ 2×
  threshold (test-enforced).
- Structural token diversity: radius/border/shadow each ≥ ~6 unique values across 12.
- Every curated font provably loads or warns; no silent fallback to system-ui.
- `setPersonality()` covered by integration tests asserting real emitted CSS variables.
- Distinctiveness matrix + Storybook grid generated from code, not hand-maintained.
