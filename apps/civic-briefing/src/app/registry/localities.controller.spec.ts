import { Test } from '@nestjs/testing';
import {
  createLocalityRegistry,
  type LocalityConfig,
  type LocalityRegistry,
} from '@optimistic-tanuki/civic-core';
import { LocalitiesController } from './localities.controller';
import { LocalityRegistrySource } from './locality-registry.source';

const town: LocalityConfig = {
  slug: 'town-ga',
  name: 'Town',
  state: 'GA',
  kind: 'town',
  parents: [],
  edition: true,
  timezone: 'America/New_York',
  lat: 31,
  lon: -83,
  topics: [],
  sources: [],
  officials: {
    domains: ['town-ga.gov'],
    roster: [],
  },
} as unknown as LocalityConfig;

class FakeSource extends LocalityRegistrySource {
  constructor(private registry: LocalityRegistry | null) {
    super();
  }
  current(): LocalityRegistry {
    if (!this.registry) throw new Error('registry not loaded');
    return this.registry;
  }
  async refresh(): Promise<LocalityRegistry> {
    return this.current();
  }
}

async function controllerFor(source: LocalityRegistrySource) {
  const moduleRef = await Test.createTestingModule({
    controllers: [LocalitiesController],
    providers: [{ provide: LocalityRegistrySource, useValue: source }],
  }).compile();
  return moduleRef.get(LocalitiesController);
}

describe('LocalitiesController', () => {
  it('replies with every locality in the registry', async () => {
    const controller = await controllerFor(
      new FakeSource(createLocalityRegistry([town]))
    );
    const reply = controller.list();
    expect(reply.map((locality) => locality.slug)).toEqual(['town-ga']);
    expect(reply[0].officials?.domains).toEqual(['town-ga.gov']);
  });

  it('fails while no registry has loaded, so the caller keeps its last one', async () => {
    const controller = await controllerFor(new FakeSource(null));
    expect(() => controller.list()).toThrow(/not loaded/u);
  });
});
