import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  IsArray,
  IsUUID,
} from 'class-validator';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum EventPrivacy {
  PUBLIC = 'public',
  PRIVATE = 'private',
  COMMUNITY = 'community',
}

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  locationUrl?: string;

  @IsOptional()
  @IsEnum(EventPrivacy)
  privacy?: EventPrivacy;

  @IsOptional()
  @IsUUID()
  communityId?: string;

  @IsString()
  profileId: string;

  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  locationUrl?: string;

  @IsOptional()
  @IsEnum(EventPrivacy)
  privacy?: EventPrivacy;

  @IsOptional()
  @IsUUID()
  communityId?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}

export class EventDto {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  locationUrl: string;
  privacy: EventPrivacy;
  communityId: string;
  profileId: string;
  userId: string;
  status: EventStatus;
  attendeeCount: number;
  attendeeIds: string[];
  coverImageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AttendEventDto {
  @IsString()
  eventId: string;

  @IsString()
  userId: string;

  @IsString()
  profileId: string;
}
