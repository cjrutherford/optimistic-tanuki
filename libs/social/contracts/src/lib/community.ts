import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export type CommunityLocalityType =
  | 'city'
  | 'town'
  | 'neighborhood'
  | 'county'
  | 'region';

/**
 * Canonical community read shape (G2). Scalar fields from
 * `apps/social/src/entities/community.entity.ts`; relations and audit stay
 * server-side.
 */
export class CommunityDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({
    required: false,
    enum: ['city', 'town', 'neighborhood', 'county', 'region'],
  })
  @IsOptional()
  @IsIn(['city', 'town', 'neighborhood', 'county', 'region'])
  localityType?: CommunityLocalityType | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  population?: number | null;
}

/** `CommunityCommands.CREATE` — the G2 canonical create path. */
export class CreateCommunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  slug?: string;
}

/** `CommunityCommands.JOIN` / `LEAVE` — membership by profile. */
export class JoinCommunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;
}

export class LeaveCommunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;
}

/** `CommunityCommands.FIND` — fetch one community by id. */
export class CommunityRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;
}
