import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Unauthenticated bug-report submission. Secured by single-use nonce
 * (see NonceService) + throttling + origin allowlist, not auth.
 */
export class SubmitBugReportDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  nonce!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsString()
  @MaxLength(2000)
  pageUrl!: string;

  @IsString()
  @MaxLength(1000)
  userAgent!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  browserLogs!: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  backendTraceIds!: string[];

  @IsString()
  @MaxLength(2_000_000)
  @Matches(/^data:image\/jpeg;base64,/)
  screenshotDataUrl!: string;

  @IsISO8601()
  occurredAt!: string;
}
