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

export type SocialPostVisibility = 'public' | 'followers' | 'community';

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

  @ApiProperty({
    enum: ['public', 'followers', 'community'],
    default: 'public',
  })
  @IsIn(['public', 'followers', 'community'])
  visibility!: SocialPostVisibility;

  @ApiProperty({ default: false })
  @IsBoolean()
  publicAudienceExplicit!: boolean;

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

  @ApiProperty({ required: false, enum: ['public', 'followers', 'community'] })
  @IsOptional()
  @IsIn(['public', 'followers', 'community'])
  visibility?: SocialPostVisibility;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  communityId?: string;
}

/** `PostCommands.UPDATE` — only updateable scalar input fields cross the wire. */
export class UpdateSocialPostDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  profileId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userId?: string;

  @ApiProperty({ required: false, default: 'social' })
  @IsOptional()
  @IsString()
  appScope?: string;

  @ApiProperty({ required: false, enum: ['public', 'followers', 'community'] })
  @IsOptional()
  @IsIn(['public', 'followers', 'community'])
  visibility?: SocialPostVisibility;

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
