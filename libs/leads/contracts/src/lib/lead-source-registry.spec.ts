import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from './leads.types';
import {
  ACTIVE_LEAD_DISCOVERY_SOURCES,
  LEAD_DISCOVERY_SOURCE_REGISTRY,
  RETIRED_LEAD_DISCOVERY_SOURCES,
  getAttributionRequiredSources,
  getLeadSourceLabel,
  getSourcesForIntent,
  isRetiredLeadSource,
  migrateTopicSources,
} from './lead-source-registry';

describe('lead source registry', () => {
  it('describes every source in the enum', () => {
    for (const source of Object.values(LeadDiscoverySource)) {
      expect(LEAD_DISCOVERY_SOURCE_REGISTRY[source]).toBeDefined();
    }
  });

  it('retires the sources that cannot return results', () => {
    // clutch and indeed answer server requests with HTTP 403; justremote's feed
    // no longer exists; crunchbase never fetched Crunchbase data.
    expect(RETIRED_LEAD_DISCOVERY_SOURCES).toEqual(
      expect.arrayContaining([
        LeadDiscoverySource.CLUTCH,
        LeadDiscoverySource.INDEED,
        LeadDiscoverySource.JUST_REMOTE,
        LeadDiscoverySource.CRUNCHBASE,
      ])
    );
    expect(ACTIVE_LEAD_DISCOVERY_SOURCES).not.toContain(
      LeadDiscoverySource.CLUTCH
    );
    expect(ACTIVE_LEAD_DISCOVERY_SOURCES).not.toContain(
      LeadDiscoverySource.INDEED
    );
  });

  it('gives every retired source a reason a user can read', () => {
    for (const source of RETIRED_LEAD_DISCOVERY_SOURCES) {
      const descriptor = LEAD_DISCOVERY_SOURCE_REGISTRY[source];
      expect(descriptor.retiredReason).toBeTruthy();
      expect(descriptor.retiredReason!.length).toBeGreaterThan(20);
    }
  });

  it('offers funding-news in place of the crunchbase label', () => {
    expect(isRetiredLeadSource(LeadDiscoverySource.CRUNCHBASE)).toBe(true);
    expect(isRetiredLeadSource(LeadDiscoverySource.FUNDING_NEWS)).toBe(false);
    expect(getLeadSourceLabel(LeadDiscoverySource.FUNDING_NEWS)).toBe(
      'Funding news'
    );
  });

  it('only returns active sources for an intent', () => {
    const jobSources = getSourcesForIntent(
      LeadTopicDiscoveryIntent.JOB_OPENINGS
    );
    expect(jobSources).toContain(LeadDiscoverySource.REMOTE_OK);
    expect(jobSources).not.toContain(LeadDiscoverySource.INDEED);

    const buyerSources = getSourcesForIntent(
      LeadTopicDiscoveryIntent.SERVICE_BUYERS
    );
    expect(buyerSources).toContain(LeadDiscoverySource.FUNDING_NEWS);
    expect(buyerSources).not.toContain(LeadDiscoverySource.CLUTCH);
  });

  it('flags the sources whose terms require attribution', () => {
    const ids = getAttributionRequiredSources().map((d) => d.id);
    expect(ids).toContain(LeadDiscoverySource.REMOTE_OK);
    expect(ids).toContain(LeadDiscoverySource.JOBICY);
    for (const descriptor of getAttributionRequiredSources()) {
      expect(descriptor.attributionNote).toBeTruthy();
    }
  });

  it('strips retired sources from a stored topic', () => {
    expect(
      migrateTopicSources(
        [
          LeadDiscoverySource.REMOTE_OK,
          LeadDiscoverySource.CLUTCH,
          LeadDiscoverySource.INDEED,
        ],
        LeadTopicDiscoveryIntent.JOB_OPENINGS
      )
    ).toEqual([LeadDiscoverySource.REMOTE_OK]);
  });

  it('substitutes defaults rather than leaving a topic with nothing to search', () => {
    const migrated = migrateTopicSources(
      [LeadDiscoverySource.CLUTCH],
      LeadTopicDiscoveryIntent.SERVICE_BUYERS
    );

    expect(migrated.length).toBeGreaterThan(0);
    expect(migrated).toContain(LeadDiscoverySource.FUNDING_NEWS);
  });

  it('never marks a keyed source as usable without noting the key', () => {
    for (const descriptor of Object.values(LEAD_DISCOVERY_SOURCE_REGISTRY)) {
      if (descriptor.requiresApiKey) {
        expect(descriptor.rateLimitNote).toBeTruthy();
      }
    }
  });
});
