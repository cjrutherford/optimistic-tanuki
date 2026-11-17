import {
  evaluateOvertureFieldRights,
  OvertureRightsPolicy,
  OvertureRightsSource,
} from './overture-rights';

type Row = {
  releaseId?: string;
  sources?: readonly OvertureRightsSource[];
  names?: { primary?: unknown };
  basic_category?: unknown;
  taxonomy?: { primary?: unknown; hierarchy?: unknown };
  geometry?: { type?: unknown; coordinates?: unknown };
  assignedCategoryIds?: unknown;
  addresses?: unknown;
};
export const LOW_RISK_ADDRESS_CATEGORIES = new Set([
  'restaurant',
  'casual_eatery',
  'fast_food_restaurant',
  'food_and_beverage_store',
  'convenience_store',
  'discount_store',
  'second_hand_store',
  'specialty_store',
  'shopping',
  'hardware_home_and_garden_store',
  'electronics_store',
  'fashion_and_apparel_store',
  'flowers_and_gifts_store',
  'gas_station',
  'auto_dealer',
  'vehicle_dealer',
  'vehicle_parts_store',
  'hotel',
]);
export const SENSITIVE_ADDRESS_PATTERN =
  /\b(shelter|safe|haven|refuge|domestic|violence|victim|abuse|crisis|trafficking|recovery|rehab|addiction|homeless|food[ -]?(pantry|bank)|free[ -]?meal|transition|transitional|treatment|reentry|outreach|charity|charitable|nonprofit|mental|family[ -]?services|women|youth|pregnancy|suicide|hiv|sober|adult|strip[ -]?club|escort|sexual|sex[ -]?shop|prison|jail|correctional|clinic|hospital|medical|health[ -]?care)\b/i;
const allowed = LOW_RISK_ADDRESS_CATEGORIES;
const sensitive = SENSITIVE_ADDRESS_PATTERN;
const hasControlCharacters = (value: string) =>
  [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });

/** Conservative, local-only category screen. This is not public-release approval. */
export function projectLocalEvaluation(
  row: Row,
  policy: OvertureRightsPolicy | undefined
) {
  const denied = { status: 'quarantined' as const };
  if (
    !row ||
    typeof row.basic_category !== 'string' ||
    !allowed.has(row.basic_category) ||
    typeof row.names?.primary !== 'string' ||
    !row.names.primary.trim() ||
    row.names.primary.length > 200 ||
    hasControlCharacters(row.names.primary) ||
    typeof row.taxonomy?.primary !== 'string' ||
    !row.taxonomy.primary.trim() ||
    !Array.isArray(row.taxonomy.hierarchy) ||
    !row.taxonomy.hierarchy.length ||
    !row.taxonomy.hierarchy.every(
      (x: unknown) => typeof x === 'string' && !!x.trim()
    ) ||
    !Array.isArray(row.assignedCategoryIds) ||
    !row.assignedCategoryIds.length ||
    !row.assignedCategoryIds.every((x) => typeof x === 'string') ||
    row.assignedCategoryIds.includes('adult')
  )
    return denied;
  const text = JSON.stringify([
    row.names.primary,
    row.basic_category,
    row.taxonomy,
    row.assignedCategoryIds,
    row.addresses,
  ]);
  if (sensitive.test(text.replace(/_/g, ' '))) return denied;
  const c = row.geometry?.coordinates;
  if (
    row.geometry?.type !== 'Point' ||
    !Array.isArray(c) ||
    c.length !== 2 ||
    ![0, 1].every(
      (i) =>
        Object.prototype.hasOwnProperty.call(c, i) &&
        typeof c[i] === 'number' &&
        Number.isFinite(c[i])
    ) ||
    Math.abs(c[0]) > 180 ||
    Math.abs(c[1]) > 90
  )
    return denied;
  const decisions = (['ingest', 'retain', 'privateDisplay'] as const).map(
    (op) => evaluateOvertureFieldRights(row, op, policy)
  );
  if (decisions.some((x) => !x.eligible)) return denied;
  const fields = decisions.flatMap((d) => Object.values(d.fields)),
    attribution = [...new Set(fields.flatMap((x) => x.attributions))];
  if (!attribution.length) return denied;
  return {
    status: 'eligible' as const,
    listing: {
      name: row.names.primary,
      category: row.basic_category,
      location: {
        type: 'Point' as const,
        coordinates: [c[0], c[1]] as [number, number],
      },
      attribution,
      notices: [...new Set(fields.flatMap((x) => x.notices))],
      termsUrls: [...new Set(fields.flatMap((x) => x.termsUrls))],
    },
  };
}
