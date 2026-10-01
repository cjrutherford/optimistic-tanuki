import { createLocalityRegistry } from '../../src/locality-registry.js';
import { ensureLocality } from '../../src/pipeline.js';
import { LocalitySchema } from '../../src/schema.js';
import type { LocalityConfig } from '../../src/types.js';
import { withTestDataSource } from './helpers/postgres.js';

const place = (
  slug: string,
  kind: string,
  parents: string[],
  edition = false
): LocalityConfig => ({
  slug,
  name: slug,
  state: 'CT',
  timezone: 'America/New_York',
  lat: 41,
  lon: -72,
  kind,
  parents,
  edition,
  topics: [],
  cadence: edition ? ['daily'] : [],
  sources: [],
});

describe("storing an edition's places", () => {
  it('stores the places around a town, so a record from a city inside it is recognised as related', async () => {
    const registry = createLocalityRegistry([
      place('connecticut', 'state', []),
      place('groton-ct', 'town', ['connecticut'], true),
      place('city-of-groton-ct', 'city', ['groton-ct']),
      place('elsewhere-ct', 'town', ['connecticut']),
    ]);
    await withTestDataSource(async (ds) => {
      await ensureLocality(ds, registry.get('groton-ct'), registry);
      const stored = new Map(
        (await ds.getRepository(LocalitySchema).find()).map((row) => [
          row.slug,
          row,
        ])
      );
      expect([...stored.keys()].sort()).toStrictEqual([
        'city-of-groton-ct',
        'connecticut',
        'groton-ct',
      ]);
      expect(stored.get('city-of-groton-ct')!.parents).toBe('["groton-ct"]');
      expect(stored.get('city-of-groton-ct')!.edition).toBe(false);
    });
  });
});
