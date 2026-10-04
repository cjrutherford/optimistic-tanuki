import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Request bodies for the community routes (plan slice P3.3). The
 * contributions service validates the substance (a real town, a published
 * meeting, the representations); these bound the shape and size of what is
 * forwarded to it. Ported from the Daylight POC.
 */

export class SubmissionSubjectRequest {
  /** `contribution` corroborates another report, named by `ref`. */
  @ApiProperty({ enum: ['meeting', 'story', 'other', 'contribution'] })
  @IsIn(['meeting', 'story', 'other', 'contribution'])
  kind!: 'meeting' | 'story' | 'other' | 'contribution';

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ref?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  text!: string;
}

export class SubmissionRepresentationsRequest {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() witnessed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ownWords?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rightsToAttachments?: boolean;
}

export class SubmissionRequest {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9-]{2,64}$/u)
  localitySlug!: string;

  @ApiProperty({ enum: ['account', 'artifact'] })
  @IsIn(['account', 'artifact'])
  kind!: 'account' | 'artifact';

  @ApiProperty({ type: SubmissionSubjectRequest })
  @ValidateNested()
  @Type(() => SubmissionSubjectRequest)
  subject!: SubmissionSubjectRequest;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/u)
  occurredOn?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  body!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  links!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  disclosedInterest?: string | null;

  @ApiProperty({ type: SubmissionRepresentationsRequest })
  @ValidateNested()
  @Type(() => SubmissionRepresentationsRequest)
  representations!: SubmissionRepresentationsRequest;
}

/** Signing up to contribute to Daylight: an explicit agreement to the contributor terms (D27). */
export class ContributorSignUpRequest {
  @ApiProperty({
    description: 'Must be true: the contributor terms are agreed.',
  })
  @Equals(true, { message: 'agree to the contributor terms' })
  agreeToTerms!: boolean;
}

export class OfficialApplicationRequest {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9-]{2,64}$/u)
  localitySlug!: string;
}

export class TakedownNoticeBody {
  @ApiProperty()
  @IsString()
  @Length(2, 200)
  claimantName!: string;
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  claimantEmail!: string;
  @ApiProperty()
  @IsString()
  @Length(5, 500)
  claimantAddress!: string;
  @ApiProperty()
  @IsString()
  @Length(5, 2000)
  work!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  locations!: string[];
  @ApiProperty()
  @Equals(true, {
    message: 'affirm your good-faith belief that the use is not authorized',
  })
  goodFaith!: boolean;
  @ApiProperty()
  @Equals(true, {
    message:
      'affirm under penalty of perjury that the notice is accurate and that you may act for the owner',
  })
  accurateUnderPenalty!: boolean;
  @ApiProperty()
  @IsString()
  @Length(2, 200)
  signature!: string;
}

export class CounterNoticeBody {
  @ApiProperty()
  @IsString()
  @Matches(/^[0-9a-f-]{36}$/u)
  noticeId!: string;
  @ApiProperty()
  @IsString()
  @Length(10, 3000)
  statement!: string;
  @ApiProperty()
  @Equals(true, { message: 'consent to the jurisdiction of the federal court' })
  consentToJurisdiction!: boolean;
  @ApiProperty()
  @Equals(true, { message: 'affirm the statement under penalty of perjury' })
  underPenalty!: boolean;
  @ApiProperty()
  @IsString()
  @Length(2, 200)
  signature!: string;
}

/** An operator's callback confirmation: who it was, where, and what was said. */
export class ConfirmOfficialCallbackBody {
  @ApiProperty()
  @IsUUID()
  userId!: string;
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9-]{2,64}$/u)
  localitySlug!: string;
  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  note!: string;
}

/** An operator's decision on a copyright notice. */
export class ActOnTakedownNoticeBody {
  @ApiProperty({ enum: ['upheld', 'declined', 'restored'] })
  @IsIn(['upheld', 'declined', 'restored'])
  action!: 'upheld' | 'declined' | 'restored';
  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  note!: string;
}
