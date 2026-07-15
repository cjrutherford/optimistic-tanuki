import { PREDEFINED_PERSONALITIES } from './personalities';
import { PRODUCT_PERSONALITIES } from './product-personalities';
import {
  allPairDistances,
  closestPair,
  minPairDistance,
  personalityDistanceBreakdown,
} from './personality-distinctiveness';

/**
 * Distinctiveness regression guard (Workstream C1, raised in Phase 3/B1+B2).
 *
 * Computed with `personalityDistance()` against the current 12 predefined
 * personalities. Before Phase 3, `soft` vs `soft-touch` was the closest pair
 * at ~0.2245 — a near-duplicate (both pastel/analogous, Quicksand heading,
 * Nunito(Sans) body, round radius, subtle shadow, slow animation, elegant
 * typography, rounded icons). Workstream B1 redesigned `soft-touch` into its
 * own "warm tactile paper" identity (Fraunces heading, Mulish body, pill
 * radius, medium shadow, friendly typography, outlined icons, deliberately
 * warmer/heavier color-generation bias) while nudging `soft` slightly further
 * toward airy/light/cool. That pair now sits at ~0.5617 — no longer close to
 * the tightest pair at all.
 *
 * After B1/B2 (which also spread previously-unused structural token values —
 * `pill` radius, `double`/`none` border style, `none` shadow intensity,
 * `instant`/`deliberate` animation speed — onto personalities whose
 * tags/description support them: `foundation` -> instant/none shadow/none
 * border, `minimal` -> none shadow, `elegant` -> deliberate/double border),
 * the closest pair across all 12 is `classic` vs `foundation` at ~0.3466.
 * That pair was flagged by the original audit as a false positive on the raw
 * metric (foundation is legitimately a separate compact/technical/
 * reduced-motion identity) — see the plan's "good, don't touch" section —
 * so a modest gap under the real computed minimum is appropriate rather than
 * chasing it further apart at the cost of foundation's coherent identity.
 */
const DISTINCTIVENESS_THRESHOLD = 0.34;

/**
 * The six product-mapped personalities' minimum pairwise distance is `bold` vs
 * `electric` at ~0.4485. (Before the Phase 3 follow-up the floor was `classic`
 * vs `professional` at ~0.4079; giving `professional` a crisp `sharp` radius —
 * a more buttoned-down enterprise read — pushed that pair apart, so the product
 * floor is now the unrelated `bold`/`electric` pair.) This is set just below
 * that real computed minimum, and remains meaningfully above
 * `DISTINCTIVENESS_THRESHOLD` (checked below) without being a clean multiple
 * of it, since the two floors are driven by unrelated pairs.
 */
const PRODUCT_DISTINCTIVENESS_THRESHOLD = 0.44;

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
