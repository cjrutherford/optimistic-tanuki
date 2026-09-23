import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Blog role values shared by `SetBlogRole` flows. Defined here from
 * `apps/profile/src/profiles/entities/profile.entity.ts` (`BlogRole`) so
 * contracts never import from an app.
 */
export enum BlogRole {
  NONE = 'none',
  POSTER = 'poster',
  OWNER = 'owner',
}

/** `ProfileCommands.Get` — id lookup, userId+appScope lookup, or both. */
export class GetProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  appScope?: string;
}

/** `ProfileCommands.Search` — gateway fan-out query. */
export class SearchProfilesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  excludeIds?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

/** `ProfileCommands.SetBlogRole`. */
export class SetBlogRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty({ enum: BlogRole })
  @IsEnum(BlogRole)
  blogRole!: BlogRole;
}

/** `TimelineCommands.Get` — `@Payload('id')` plus optional find-one options. */
export class TimelineRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;
}
