export const LeadCommands = {
  FIND_ALL: 'lead.findAll',
  FIND_ONE: 'lead.findOne',
  CREATE: 'lead.create',
  UPDATE: 'lead.update',
  DELETE: 'lead.delete',
  GET_STATS: 'lead.getStats',
  SEARCH: 'lead.search',
} as const;

export const LeadTopicCommands = {
  FIND_ALL: 'lead.topic.findAll',
  CREATE: 'lead.topic.create',
  UPDATE: 'lead.topic.update',
  DELETE: 'lead.topic.delete',
  RUN_DISCOVERY: 'lead.topic.runDiscovery',
  GET_DISCOVERY_STATUS: 'lead.topic.getDiscoveryStatus',
} as const;

export const LeadFlagCommands = {
  FIND_BY_LEAD: 'lead.flag.findByLead',
  CREATE: 'lead.flag.create',
} as const;

export const LeadOnboardingCommands = {
  ANALYZE: 'leads.onboarding.analyze',
  ANALYZE_MAD_LIB: 'leads.onboarding.mad-lib.analyze',
  PARSE_RESUME: 'leads.onboarding.resume.parse',
  ADVANCE_DISC: 'leads.onboarding.disc.advance',
  CONFIRM: 'leads.onboarding.confirm',
  AUTOCOMPLETE_LOCATIONS: 'leads.locations.autocomplete',
} as const;

export const LeadAnalysisCommands = {
  RUN: 'leads.analysis.run',
} as const;
