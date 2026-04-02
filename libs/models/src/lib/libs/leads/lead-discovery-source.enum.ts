export enum LeadDiscoverySource {
  REMOTE_OK = 'remoteok',
  HIMALAYAS = 'himalayas',
  WE_WORK_REMOTELY = 'weworkremotely',
  JUST_REMOTE = 'justremote',
  JOBICY = 'jobicy',
  CLUTCH = 'clutch',
  CRUNCHBASE = 'crunchbase',
  INDEED = 'indeed',
  GOOGLE_MAPS = 'google-maps',
}

export const DEFAULT_LEAD_DISCOVERY_SOURCES: LeadDiscoverySource[] = [
  LeadDiscoverySource.REMOTE_OK,
  LeadDiscoverySource.HIMALAYAS,
  LeadDiscoverySource.WE_WORK_REMOTELY,
  LeadDiscoverySource.JUST_REMOTE,
  LeadDiscoverySource.JOBICY,
  LeadDiscoverySource.CLUTCH,
  LeadDiscoverySource.CRUNCHBASE,
  LeadDiscoverySource.INDEED,
  LeadDiscoverySource.GOOGLE_MAPS,
];