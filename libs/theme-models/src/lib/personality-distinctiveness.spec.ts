import { PREDEFINED_PERSONALITIES } from './personalities';
import { PRODUCT_PERSONALITIES } from './product-personalities';
import {
  allPairDistances,
  closestPair,
  minPairDistance,
  personalityDistanceBreakdown,
} from './personality-distinctiveness';

/**
 * Distinctiveness regression guard (Workstream C1, raised in Phase 3/B1+B2,
 * re-seeded again in the 2026-07-18 personality-styles-refactor plan's
 * Phase 3 when `tokens.shadowProfile` (joint B2) was added as a weighted
 * dimension).
 *
 * Computed with `personalityDistance()` against the current 12 predefined
 * personalities. Before Phase 3, `soft` vs `soft-touch` was the closest pair
 * at ~0.2245 — a near-duplicate (both pastel/analogous, Quicksand heading,
 * Nunito(Sans) body, round radius, subtle shadow, slow animation, elegant
 * typography, rounded icons). Workstream B1 redesigned `soft-touch` into its
 * own "warm tactile paper" identity (Fraunces heading, Mulish body, pill
 * radius, medium shadow, friendly typography, outlined icons, deliberately
 * warmer/heavier color-generation bias) while nudging `soft` slightly further
 * toward airy/light/cool. That pair now sits well above the tightest pair.
 *
 * After B1/B2 (which also spread previously-unused structural token values —
 * `pill` radius, `double`/`none` border style, `none` shadow intensity,
 * `instant`/`deliberate` animation speed — onto personalities whose
 * tags/description support them: `foundation` -> instant/none shadow/none
 * border, `minimal` -> none shadow, `elegant` -> deliberate/double border),
 * the closest pair across all 12 was `classic` vs `foundation` at ~0.3466.
 * That pair was flagged by the original audit as a false positive on the raw
 * metric (foundation is legitimately a separate compact/technical/
 * reduced-motion identity) — see the plan's "good, don't touch" section —
 * so a modest gap under the real computed minimum is appropriate rather than
 * chasing it further apart at the cost of foundation's coherent identity.
 *
 * Adding `tokens.shadowProfile` (joint B2, weight 0.03) as its own
 * categorical dimension moved that same pair further apart still —
 * `classic` is `layered`, `foundation` is `technical`, a full-unit mismatch
 * on the new dimension — to ~0.3656. `classic` vs `foundation` remains the
 * closest pair (still the legitimate false-positive from the audit, not a
 * new near-duplicate), so the threshold was re-seeded just below that new
 * real minimum (0.36) rather than left at the stale, now-looser 0.34.
 *
 * Phase 5 of the same plan (Workstream C1/D3) added `pageBackground.pattern`
 * (weight 0.02) once 10 of 12 personalities gained an authored page
 * background. `classic` and `foundation` are both on the documented flat
 * list (no `pageBackground`), so `categorical()`'s "both undefined counts as
 * equal" rule means this pair scores **0** on the new dimension — an
 * unweighted average that includes a 0 term necessarily pulls down, moving
 * `classic` vs `foundation` from ~0.3656 to ~0.3587 (still the closest pair,
 * still the same legitimate false-positive — the new dimension doesn't
 * change *why* they're closest, only dilutes the score slightly because the
 * new axis correctly finds them alike on it). Re-seeded again, just below
 * the new real minimum.
 *
 * Phase 5b (Workstream E1/D3) added `colorGeneration.surfaceHueBias`
 * (categorical, weight 0.015) and `colorGeneration.surfaceLuminosityOffset`
 * (numeric, JND scale 3, weight 0.015). `foundation` was given a `cool`
 * surface bias while `classic` stayed `none`, and their
 * `surfaceLuminosityOffset`s were spread apart (`classic` -2, `foundation`
 * -1) as part of the same phase's deliberate >= 6-unique-value spread across
 * all 12 personalities — both new dimensions score this pair as (partially)
 * different rather than alike, moving `classic` vs `foundation` UP from
 * ~0.3587 to ~0.3672 (still the closest pair, still the same legitimate
 * false-positive). Since the floor moved up (not down), the previous 0.35
 * threshold remained technically safe, but is re-seeded to 0.36 — just below
 * the new real minimum — to keep following this suite's own convention
 * rather than leaving an increasingly stale gap.
 */
const DISTINCTIVENESS_THRESHOLD = 0.36;

/**
 * The six product-mapped personalities' minimum pairwise distance was `bold`
 * vs `electric` at ~0.4485 (giving `professional` a crisp `sharp` radius had
 * pushed the earlier `classic`/`professional` floor apart at the time).
 * Adding `tokens.shadowProfile` moved `classic` (layered) vs `professional`
 * (also layered — no shift there) together only slightly, but shifted
 * `bold` (playful-drop) vs `electric` (neon) further apart (a full-unit
 * mismatch on the new dimension), which flipped the floor back to `classic`
 * vs `professional` at ~0.4531. Re-seeded just below that new real minimum,
 * and remains meaningfully above `DISTINCTIVENESS_THRESHOLD` (checked below)
 * without being a clean multiple of it, since the two floors are driven by
 * unrelated pairs.
 *
 * Phase 5's `pageBackground.pattern` dimension (see above) moved this floor
 * again: every product-mapped personality except `classic` now has a unique
 * authored pattern, so the new dimension adds a full-unit distance to most
 * product pairs and nudges the whole set apart. The floor stayed at
 * `classic` vs `professional`, now ~0.4635 (both still flat/no-pattern...
 * no — `professional` now has a `pageBackground`; the pair scores a full
 * unit on the new axis same as any pattern-vs-flat pair, which is why the
 * floor moved *up* here instead of down as it did for the general set).
 * Still comfortably above 0.45, so the threshold itself did not need to
 * move this round.
 *
 * Phase 5b's surface dimensions (see `DISTINCTIVENESS_THRESHOLD` above) flip
 * the floor again: `bold` (surface `primary`/+6, offset -5) vs `electric`
 * (surface `primary`/+9, offset -6) now edges out `classic` vs
 * `professional` as the closest product pair, at ~0.4662 (both share the
 * `primary` hue bias — the one categorical dimension where they DON'T
 * differ — but their differing shadow profiles, fonts, and harmony types
 * still keep them well-separated). Re-seeded to 0.46 — just below this new
 * real minimum — following the same convention as
 * `DISTINCTIVENESS_THRESHOLD`.
 */
const PRODUCT_DISTINCTIVENESS_THRESHOLD = 0.46;

describe('personality distinctiveness', () => {
  it('logs the closest pair for visibility', () => {
    const closest = closestPair(PREDEFINED_PERSONALITIES);
    expect(closest).toBeDefined();
    if (!closest) return;

    const breakdown = personalityDistanceBreakdown(closest.a, closest.b)
      .slice(0, 5)
      .map((f) => `${f.id}=${f.distance.toFixed(2)} (w=${f.weight})`)
      .join(', ');

    console.info(
      `[personality-distinctiveness] closest pair: ${closest.a.id} vs ` +
        `${closest.b.id} = ${closest.distance.toFixed(
          4
        )}. Top contributors: ${breakdown}`
    );

    expect(closest.distance).toBeGreaterThan(0);
  });

  it('has no personality pair below the distinctiveness threshold', () => {
    const pairs = allPairDistances(PREDEFINED_PERSONALITIES);
    expect(pairs.length).toBeGreaterThan(0);

    const violations = pairs
      .filter((pair) => pair.distance < DISTINCTIVENESS_THRESHOLD)
      .map(
        (pair) => `${pair.a.id} vs ${pair.b.id}: ${pair.distance.toFixed(4)}`
      );

    expect(violations).toEqual([]);

    const min = minPairDistance(PREDEFINED_PERSONALITIES);
    expect(min).toBeGreaterThanOrEqual(DISTINCTIVENESS_THRESHOLD);
  });

  it('keeps the product-mapped personalities more mutually distinct than the general floor', () => {
    const productIds = new Set(Object.values(PRODUCT_PERSONALITIES));
    // Confirm the exact product set the plan calls out (classic, soft-touch,
    // bold, professional, electric, architect) hasn't silently drifted.
    expect([...productIds].sort()).toEqual(
      [
        'architect',
        'bold',
        'classic',
        'electric',
        'professional',
        'soft-touch',
      ].sort()
    );

    const productPersonalities = PREDEFINED_PERSONALITIES.filter((p) =>
      productIds.has(p.id)
    );
    expect(productPersonalities).toHaveLength(productIds.size);

    const pairs = allPairDistances(productPersonalities);
    const violations = pairs
      .filter((pair) => pair.distance < PRODUCT_DISTINCTIVENESS_THRESHOLD)
      .map(
        (pair) => `${pair.a.id} vs ${pair.b.id}: ${pair.distance.toFixed(4)}`
      );

    expect(violations).toEqual([]);

    const min = minPairDistance(productPersonalities);
    expect(min).toBeGreaterThanOrEqual(PRODUCT_DISTINCTIVENESS_THRESHOLD);
    // Product personalities should clear a meaningfully higher bar than the
    // general "no near-duplicates" floor.
    expect(min).toBeGreaterThan(DISTINCTIVENESS_THRESHOLD);
  });
});
