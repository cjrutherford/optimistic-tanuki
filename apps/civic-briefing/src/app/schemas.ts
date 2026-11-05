import { FOUNDATION_SCHEMAS } from '@optimistic-tanuki/civic-core';
import type { EntitySchema } from 'typeorm';
import { DaylightAlertSchema } from './health/daylight-alert.schema';
import { OfficialCandidateSchema } from './officials/official-candidate.schema';
import { SourceRequestSchema } from './registry/source-request.schema';
import { SourcingDecisionSchema } from './schedule/sourcing-decision.schema';

/**
 * Every table civic-briefing owns: civic-core's foundation, plus the
 * service's own operational records.
 */
export const BRIEFING_SCHEMAS = [
  ...(FOUNDATION_SCHEMAS as readonly EntitySchema<unknown>[]),
  DaylightAlertSchema as EntitySchema<unknown>,
  SourcingDecisionSchema as EntitySchema<unknown>,
  SourceRequestSchema as EntitySchema<unknown>,
  OfficialCandidateSchema as EntitySchema<unknown>,
];
