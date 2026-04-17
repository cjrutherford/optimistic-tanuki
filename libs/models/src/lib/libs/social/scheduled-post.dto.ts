import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateScheduledPostDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsString()
  profileId: string;

  @IsString()
  userId: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsEnum(['public', 'followers'])
  visibility?: 'public' | 'followers';

  @IsOptional()
  @IsUUID()
  communityId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class UpdateScheduledPostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsEnum(['public', 'followers'])
  visibility?: 'public' | 'followers';

  @IsOptional()
  @IsUUID()
  communityId?: string;
}

export class ScheduledPostDto {
  id: string;
  title: string;
  content: string;
  profileId: string;
  userId: string;
  scheduledAt: Date;
  visibility: 'public' | 'followers';
  communityId: string;
  isScheduled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
