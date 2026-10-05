import { FOUNDATION_SCHEMAS } from '@optimistic-tanuki/civic-core';
import type { EntitySchema } from 'typeorm';
import { DaylightAlertSchema } from './health/daylight-alert.schema';

/**
 * Every table civic-briefing owns: civic-core's foundation, plus the
 * service's own operational records.
 */
export const BRIEFING_SCHEMAS = [
  ...(FOUNDATION_SCHEMAS as readonly EntitySchema<unknown>[]),
  DaylightAlertSchema as EntitySchema<unknown>,
];
