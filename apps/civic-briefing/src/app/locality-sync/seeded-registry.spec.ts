import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadLocalityRegistry,
  renderLocalityRegistry,
  writeLocalityRegistry,
  type LocalityRow,
} from '@optimistic-tanuki/civic-core';
import {
  DEFAULT_CADENCE,
  DEFAULT_TOPICS,
  batchPeers,
  communityToLocality,
  stateRootRow,
  usRootRow,
} from './community-to-locality';

interface SeedCity {
  name: string;
  slug: string;
  localitySlug?: string;
  localityType?: string;
  state: string;
  lat: number;
  lng: number;
}

/** Contract between the social sync (S2) and the registry renderer (S3): every seeded town must survive into a loadable registry. */
describe('seeded towns → generated registry', () => {
  const seed: SeedCity[] = (
    JSON.parse(
      readFileSync(
        join(__dirname, '../../../../social/src/data/seed-cities.json'),
        'utf8'
      )
    ) as { localities: SeedCity[] }
  ).localities;

  it('maps, renders and loads every seeded town with nothing excluded', () => {
    const communities = seed.map((city, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: city.name,
      slug: city.slug,
      localitySlug: city.localitySlug,
      localityType: city.localityType,
      adminArea: city.state,
      lat: city.lat,
      lng: city.lng,
    }));
    const peers = batchPeers(communities);
    const rows = new Map<string, LocalityRow>([['us', usRootRow()]]);
    const unmapped: string[] = [];
    communities.forEach((community) => {
      const mapped = communityToLocality(
        community,
        { topics: DEFAULT_TOPICS, cadence: DEFAULT_CADENCE },
        { peers }
      );
      if (!mapped.ok) {
        unmapped.push(`${community.slug}: ${mapped.reason}`);
        return;
      }
      rows.set(mapped.row.slug, mapped.row);
      const root = stateRootRow(mapped.state);
      if (!rows.has(root.slug)) rows.set(root.slug, root);
    });
    expect(unmapped).toEqual([]);

    const rendered = renderLocalityRegistry([...rows.values()], []);
    expect(rendered.excluded).toEqual([]);

    const dir = mkdtempSync(join(tmpdir(), 'seeded-registry-'));
    try {
      const target = join(dir, 'localities');
      writeLocalityRegistry(target, rendered.files);
      const registry = loadLocalityRegistry(target);
      const wanted = seed.filter(
        (city) => city.localityType === 'city' || city.localityType === 'town'
      ).length;
      expect(wanted).toBe(262);
      expect(registry.editions()).toHaveLength(wanted);
      expect(registry.all().length).toBeGreaterThan(registry.editions().length);
      expect(registry.get('nashville-ga')?.excludePhrases).toEqual([
        'Nashville, Tennessee',
        'Nashville, Tenn.',
        'Nashville, TN',
      ]);
      expect(registry.get('adel-ga')?.timezone).toBe('America/New_York');
      expect(registry.get('nashville-ga')?.name).toBe('Nashville');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
