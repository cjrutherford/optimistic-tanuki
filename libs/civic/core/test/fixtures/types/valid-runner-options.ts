import type { DataSource } from 'typeorm';
import type { RunPipelineOptions } from '../../../src/runner.js';

export const validRunnerOptions = {
  registry: null as never,
  localitySlug: 'town-a',
  cadence: 'daily',
  dataSource: null as unknown as DataSource,
  summarizer: null as never,
} satisfies RunPipelineOptions;
