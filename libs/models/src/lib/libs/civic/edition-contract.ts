import { ApiProperty } from '@nestjs/swagger';

/**
 * The published-briefing contract between civic-briefing, the gateway and
 * Towne Square's pages (plan slice P3.1). Plain data, no behaviour; the web
 * client is generated from these schemas.
 */
export class EditionSummary {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  state!: string;

  /** The newest published period's end date (YYYY-MM-DD), or null. */
  @ApiProperty({ type: String, nullable: true })
  latest!: string | null;
}

export class BriefingSummary {
  @ApiProperty()
  cadence!: string;

  @ApiProperty()
  periodStart!: string;

  @ApiProperty()
  periodEnd!: string;
}

export class EditionHistory extends EditionSummary {
  @ApiProperty({ type: [BriefingSummary] })
  briefings!: BriefingSummary[];
}

export class PublishedBriefing extends BriefingSummary {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  markdown!: string;
}
