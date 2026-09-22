import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/** Mirrors `PublicationStatusSchema` in learning-domain. Pinned by the parity spec. */
export enum PublicationStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

/**
 * Max co-editors per offering. Mirrors `CO_EDITOR_PROFILE_ID_MAX` in
 * learning-domain (contracts cannot import `type:domain`).
 */
export const CO_EDITOR_PROFILE_ID_MAX = 50;

/** Who is asking to see the catalog. Mirrors `CatalogViewer` in learning-domain. */
export class CatalogViewerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  seesEveryDraft?: boolean;
}

/** `LearningCommands.GetLesson`. */
export class GetLessonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  trackId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lessonId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  offeringId?: string;
}

/** `LearningCommands.GetOffering`. */
export class GetOfferingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  offeringId!: string;

  @ApiProperty({ required: false, type: CatalogViewerDto })
  @IsOptional()
  @Type(() => CatalogViewerDto)
  viewer?: CatalogViewerDto;
}

/** `LearningCommands.ListMyOfferings`. */
export class ListMyOfferingsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;
}

/** `LearningCommands.GetDashboard` — profile optional (anonymous gets the public slice). */
export class GetDashboardDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileId?: string;
}

/** `LearningCommands.ListChallenges`. */
export class ListChallengesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  trackId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiProperty({ required: false, type: CatalogViewerDto })
  @IsOptional()
  @Type(() => CatalogViewerDto)
  viewer?: CatalogViewerDto;
}

/** `LearningCommands.CreateOffering` — mirrors `DraftOfferingInput`. */
export class CreateOfferingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  level?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  credits?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  outcomeTags?: string[];
}

/**
 * `LearningCommands.UpdateOffering` — deep content (modules, activities)
 * stays zod-validated domain-side; the envelope carries scalar/text updates.
 */
export class UpdateOfferingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  offeringId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: PublicationStatus })
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;
}

/** `LearningCommands.DeleteOffering` and `GetOfferingOwnership`. */
export class OfferingRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  offeringId!: string;
}

/** `LearningCommands.SetOfferingStatus`. */
export class SetOfferingStatusDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  offeringId!: string;

  @ApiProperty({ enum: PublicationStatus })
  @IsEnum(PublicationStatus)
  status!: PublicationStatus;
}

/**
 * `LearningCommands.SetCoEditors` — promotes the gateway `SetCoEditorsDto`
 * (trim + unique + UUID + max) wrapped with the offering id.
 */
export class SetCoEditorsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  offeringId!: string;

  @ApiProperty({ type: [String], maxItems: CO_EDITOR_PROFILE_ID_MAX })
  @IsArray()
  @ArrayMaxSize(CO_EDITOR_PROFILE_ID_MAX)
  @ArrayUnique()
  @IsString({ each: true })
  @IsUUID(undefined, { each: true })
  coEditorProfileIds!: string[];
}
