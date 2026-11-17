import {
  LOW_RISK_ADDRESS_CATEGORIES,
  SENSITIVE_ADDRESS_PATTERN,
} from './overture-local-evaluation';

export interface AddressRiskClassification {
  residential?: boolean;
  sensitive?: boolean;
  adult?: boolean;
  reasons: string[];
}

const ADULT_CATEGORY = 'adult_entertainment_venue';
const POSSIBLE_RESIDENTIAL_UNIT = /\b(?:apt|apartment|unit)\b/i;

/**
 * Conservative rule-based address risk screen. A `false` value means the
 * classification is clear; `undefined` means a human must decide. The engine
 * only auto-approves when every flag is explicitly false.
 */
export function classifyAddressRisk(input: {
  name: string;
  category: string;
  taxonomy?: readonly string[];
  assignedCategoryIds?: readonly string[];
  address?: string;
}): AddressRiskClassification {
  const reasons: string[] = [];
  const category = typeof input.category === 'string' ? input.category : '';
  const text = [
    input.name,
    category,
    ...(input.taxonomy ?? []),
    ...(input.assignedCategoryIds ?? []),
    input.address,
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .replace(/_/g, ' ');
  const adult =
    category === ADULT_CATEGORY ||
    (input.assignedCategoryIds ?? []).includes('adult') ||
    /\b(adult|strip club|escort|sexual|sex shop)\b/i.test(text);
  const sensitive = SENSITIVE_ADDRESS_PATTERN.test(text);
  if (adult) reasons.push('adult_category_or_text');
  if (sensitive) reasons.push('sensitive_category_or_text');

  let residential: boolean | undefined;
  if (adult || sensitive) {
    residential = false;
  } else if (!LOW_RISK_ADDRESS_CATEGORIES.has(category)) {
    residential = undefined;
    reasons.push('category_requires_human_review');
  } else if (
    typeof input.address === 'string' &&
    POSSIBLE_RESIDENTIAL_UNIT.test(input.address)
  ) {
    residential = undefined;
    reasons.push('possible_residential_unit');
  } else {
    residential = false;
  }

  return { residential, sensitive, adult, reasons };
}
