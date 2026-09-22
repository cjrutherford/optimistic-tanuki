import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Canonical social-post read shape (E18). Named `SocialPost` so generated
 * clients cannot confuse it with the blogging `BlogPost`. Mirrors
 * `apps/social/src/entities/post.entity.ts` (scalar fields only — relations
 * stay server-side).
 */
export class SocialPostDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ default: 'social' })
  @IsString()
  @IsNotEmpty()
  appScope!: string;

  @ApiProperty({ enum: ['public', 'followers'], default: 'public' })
  @IsIn(['public', 'followers'])
  visibility!: 'public' | 'followers';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  communityId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isScheduled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAt?: Date;
}

/** `PostCommands.CREATE` — only scalar creation fields cross the wire. */
export class CreateSocialPostDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ required: false, default: 'social' })
  @IsOptional()
  @IsString()
  appScope?: string;

  @ApiProperty({ required: false, enum: ['public', 'followers'] })
  @IsOptional()
  @IsIn(['public', 'followers'])
  visibility?: 'public' | 'followers';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  communityId?: string;
}

/** `PostCommands.FIND` — fetch one post by id. */
export class SocialPostRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  postId!: string;
}
