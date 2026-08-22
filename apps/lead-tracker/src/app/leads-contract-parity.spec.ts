import * as modelsContracts from '@optimistic-tanuki/models/leads-contracts';
import * as publishedContracts from '@optimistic-tanuki/leads-contracts';

/**
 * `libs/models` and `libs/leads/contracts` deliberately define the same enums
 * twice.
 *
 * The duplication is structural, not an oversight: `leads-contracts` is a
 * publishable npm package (`private: false`), while `models` is
 * `visibility:internal` and carries the TypeORM entities. A published package
 * cannot depend on an internal, entity-laden lib, and the workspace's
 * `type:contracts → type:util` boundary rule enforces that.
 *
 * What the duplication lacks is any guard against drift — and drift here is
 * both silent and dangerous, because these values are persisted as a Postgres
 * enum. A value present in one lib and missing from the other fails at the
 * database boundary at runtime rather than at compile time.
 *
 * This spec lives in lead-tracker because it is one of the few projects allowed
 * to import both libs.
 */
describe('lead contract parity between models and leads-contracts', () => {
  const duplicated = [
    'LeadSource',
    'LeadDiscoverySource',
    'LeadStatus',
    'LeadFlagReason',
    'LeadTopicDiscoveryIntent',
  ] as const;

  it.each(duplicated)('%s has identical members in both libs', (enumName) => {
    const fromModels = (modelsContracts as Record<string, unknown>)[enumName];
    const fromPublished = (publishedContracts as Record<string, unknown>)[
      enumName
    ];

    expect(fromModels).toBeDefined();
    expect(fromPublished).toBeDefined();

    // Compare as sorted key/value pairs so a reordering is not a failure but
    // an added, removed, or renamed member is.
    const normalize = (source: unknown) =>
      Object.entries(source as Record<string, string>).sort(([a], [b]) =>
        a.localeCompare(b)
      );

    expect(normalize(fromPublished)).toEqual(normalize(fromModels));
  });

  it('keeps the two AspirationalCompany shapes structurally compatible', () => {
    // Types are erased at runtime, so this asserts on a value that must satisfy
    // both declarations — it fails to compile if either shape changes.
    const fromModels: modelsContracts.AspirationalCompany = {
      provider: 'greenhouse',
      token: 'figma',
      label: 'Figma',
    };
    const fromPublished: publishedContracts.AspirationalCompany = fromModels;

    expect(fromPublished).toEqual(fromModels);
  });
});
