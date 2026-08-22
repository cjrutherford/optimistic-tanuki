export enum LeadDiscoverySource {
  REMOTE_OK = 'remoteok',
  HIMALAYAS = 'himalayas',
  WE_WORK_REMOTELY = 'weworkremotely',
  JUST_REMOTE = 'justremote',
  JOBICY = 'jobicy',
  CLUTCH = 'clutch',
  CRUNCHBASE = 'crunchbase',
  FUNDING_NEWS = 'funding-news',
  ARBEITNOW = 'arbeitnow',
  REMOTIVE = 'remotive',
  THE_MUSE = 'themuse',
  HACKER_NEWS = 'hackernews',
  OVERPASS = 'overpass',
  GREENHOUSE = 'greenhouse',
  LEVER = 'lever',
  INDEED = 'indeed',
  GOOGLE_MAPS = 'google-maps',
}

/**
 * Sources a new topic gets by default.
 *
 * Retired ids (`clutch`, `indeed`, `crunchbase`, `justremote`) stay in the enum
 * so historical leads keep their provenance, but they are deliberately absent
 * here — see `LEAD_DISCOVERY_SOURCE_REGISTRY` in `@optimistic-tanuki/leads-contracts`
 * for why each was retired.
 */
export const DEFAULT_LEAD_DISCOVERY_SOURCES: LeadDiscoverySource[] = [
  LeadDiscoverySource.REMOTE_OK,
  LeadDiscoverySource.HIMALAYAS,
  LeadDiscoverySource.WE_WORK_REMOTELY,
  LeadDiscoverySource.JOBICY,
  LeadDiscoverySource.ARBEITNOW,
  LeadDiscoverySource.REMOTIVE,
  LeadDiscoverySource.THE_MUSE,
  LeadDiscoverySource.HACKER_NEWS,
  LeadDiscoverySource.FUNDING_NEWS,
  LeadDiscoverySource.OVERPASS,
  LeadDiscoverySource.GOOGLE_MAPS,
];
