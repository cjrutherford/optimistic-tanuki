import { ApiProperty } from '@nestjs/swagger';
import { PipelineHealthReport } from './pipeline-health';

/**
 * The Daylight operations dashboard: the last 24 hours, summarised as the
 * daily digest summarises them, and a per-day trend for the last week.
 */

export class DigestTownCounts {
  /** Towns that ran in the window; weekly towns rarely do. */
  @ApiProperty()
  ran!: number;

  /** Towns with at least one run that produced an edition. */
  @ApiProperty()
  succeeded!: number;

  /** Towns whose every run in the window failed. */
  @ApiProperty()
  failedOnly!: number;
}

export class DigestRunCounts {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  succeeded!: number;

  @ApiProperty()
  partial!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  skipped!: number;

  @ApiProperty()
  running!: number;
}

export class DigestCauseSummary {
  /** Stable across runs and towns, so the same cause is counted once. */
  @ApiProperty()
  key!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({
    enum: [
      'model-unavailable',
      'model-timeout',
      'grounding',
      'invalid-output',
      'pipeline',
    ],
  })
  kind!:
    | 'model-unavailable'
    | 'model-timeout'
    | 'grounding'
    | 'invalid-output'
    | 'pipeline';

  @ApiProperty()
  count!: number;

  @ApiProperty({ type: [String] })
  towns!: string[];
}

export class DigestCallCounts {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  successful!: number;

  /** Calls the model service never answered. */
  @ApiProperty()
  unavailable!: number;
}

export class DigestModelSummary {
  @ApiProperty()
  operation!: string;

  @ApiProperty()
  model!: string;

  @ApiProperty()
  calls!: number;

  @ApiProperty()
  successful!: number;

  @ApiProperty()
  unavailable!: number;

  /** Over answered calls only; 0 when none were answered. */
  @ApiProperty()
  p95LatencyMs!: number;
}

export class DigestFailingSource {
  @ApiProperty()
  town!: string;

  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  adapter!: string;

  @ApiProperty()
  attempts!: number;
}

export class DigestSourceSummary {
  @ApiProperty({ type: [DigestFailingSource] })
  failing!: DigestFailingSource[];

  @ApiProperty()
  stale!: number;

  @ApiProperty()
  staleTowns!: number;
}

export class DigestTownRequest {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  requests!: number;
}

export class DigestAlertCounts {
  @ApiProperty()
  opened!: number;

  @ApiProperty()
  resolved!: number;
}

export class PipelineDigestSummary {
  @ApiProperty()
  since!: string;

  @ApiProperty()
  until!: string;

  @ApiProperty({ enum: ['healthy', 'degraded', 'outage', 'idle'] })
  verdict!: 'healthy' | 'degraded' | 'outage' | 'idle';

  @ApiProperty({ type: DigestTownCounts })
  towns!: DigestTownCounts;

  @ApiProperty({ type: DigestRunCounts })
  runs!: DigestRunCounts;

  @ApiProperty({ type: [DigestCauseSummary] })
  runFailures!: DigestCauseSummary[];

  @ApiProperty({ type: DigestCallCounts })
  calls!: DigestCallCounts;

  @ApiProperty({ type: [DigestModelSummary] })
  models!: DigestModelSummary[];

  /** Model output rejected by validation, by rule. */
  @ApiProperty({ type: [DigestCauseSummary] })
  rejections!: DigestCauseSummary[];

  @ApiProperty()
  outageHours!: number;

  @ApiProperty({ type: DigestSourceSummary })
  sources!: DigestSourceSummary;

  /** Towns readers asked for that have no sources yet. */
  @ApiProperty({ type: [DigestTownRequest] })
  noSources!: DigestTownRequest[];

  @ApiProperty({ type: DigestAlertCounts })
  alerts!: DigestAlertCounts;

  @ApiProperty({ type: [String] })
  improvements!: string[];
}

/** One day of runs and model calls, in the dashboard's timezone. */
export class PipelineTrendDay {
  /** YYYY-MM-DD. */
  @ApiProperty()
  day!: string;

  @ApiProperty()
  runsSucceeded!: number;

  @ApiProperty()
  runsPartial!: number;

  @ApiProperty()
  runsFailed!: number;

  @ApiProperty()
  callsSuccessful!: number;

  /** Calls the model service never answered. */
  @ApiProperty()
  callsUnavailable!: number;

  /** Calls answered but rejected by validation. */
  @ApiProperty()
  callsRejected!: number;
}

export class PipelineDashboard {
  @ApiProperty({ type: PipelineHealthReport })
  health!: PipelineHealthReport;

  @ApiProperty({ type: PipelineDigestSummary })
  digest!: PipelineDigestSummary;

  /** Oldest first, one entry per day including empty days. */
  @ApiProperty({ type: [PipelineTrendDay] })
  trend!: PipelineTrendDay[];

  @ApiProperty()
  timeZone!: string;
}
