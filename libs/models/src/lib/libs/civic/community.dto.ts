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
  @IsIn(['meeting', 'story', 'other', 'contribution'])
  kind!: 'meeting' | 'story' | 'other' | 'contribution';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ref?: string | null;

  @IsString()
  @MaxLength(200)
  text!: string;
}

export class SubmissionRepresentationsRequest {
  @IsOptional() @IsBoolean() witnessed?: boolean;
  @IsOptional() @IsBoolean() ownWords?: boolean;
  @IsOptional() @IsBoolean() rightsToAttachments?: boolean;
}

export class SubmissionRequest {
  @IsString()
  @Matches(/^[a-z0-9-]{2,64}$/u)
  localitySlug!: string;

  @IsIn(['account', 'artifact'])
  kind!: 'account' | 'artifact';

  @ValidateNested()
  @Type(() => SubmissionSubjectRequest)
  subject!: SubmissionSubjectRequest;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/u)
  occurredOn?: string | null;

  @IsString()
  @MaxLength(5000)
  body!: string;

  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  links!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  disclosedInterest?: string | null;

  @ValidateNested()
  @Type(() => SubmissionRepresentationsRequest)
  representations!: SubmissionRepresentationsRequest;
}

export class OfficialApplicationRequest {
  @IsString()
  @Matches(/^[a-z0-9-]{2,64}$/u)
  localitySlug!: string;
}

export class TakedownNoticeBody {
  @IsString() @Length(2, 200) claimantName!: string;
  @IsEmail() @MaxLength(254) claimantEmail!: string;
  @IsString() @Length(5, 500) claimantAddress!: string;
  @IsString() @Length(5, 2000) work!: string;
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  locations!: string[];
  @Equals(true, {
    message: 'affirm your good-faith belief that the use is not authorized',
  })
  goodFaith!: boolean;
  @Equals(true, {
    message:
      'affirm under penalty of perjury that the notice is accurate and that you may act for the owner',
  })
  accurateUnderPenalty!: boolean;
  @IsString() @Length(2, 200) signature!: string;
}

export class CounterNoticeBody {
  @IsString() @Matches(/^[0-9a-f-]{36}$/u) noticeId!: string;
  @IsString() @Length(10, 3000) statement!: string;
  @Equals(true, { message: 'consent to the jurisdiction of the federal court' })
  consentToJurisdiction!: boolean;
  @Equals(true, { message: 'affirm the statement under penalty of perjury' })
  underPenalty!: boolean;
  @IsString() @Length(2, 200) signature!: string;
}

/** An operator's callback confirmation: who it was, where, and what was said. */
export class ConfirmOfficialCallbackBody {
  @IsUUID() userId!: string;
  @IsString()
  @Matches(/^[a-z0-9-]{2,64}$/u)
  localitySlug!: string;
  @IsString() @Length(1, 2000) note!: string;
}

/** An operator's decision on a copyright notice. */
export class ActOnTakedownNoticeBody {
  @IsIn(['upheld', 'declined', 'restored'])
  action!: 'upheld' | 'declined' | 'restored';
  @IsString() @Length(1, 2000) note!: string;
}
