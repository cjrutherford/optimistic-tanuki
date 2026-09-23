import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Explicit all-optional mirror of CreateProfileDto (replaces PartialType,
 * whose inherited Swagger metadata is invisible without the CLI plugin —
 * the generated client and gateway validation previously saw only `id`,
 * silently stripping every updated field).
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'ID of the profile' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'Name of the profile' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Description of the profile' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'User ID associated with the profile' })
  @IsOptional()
  @IsString()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'URL of the profile picture' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  profilePic?: string;

  @ApiPropertyOptional({ description: 'URL of the cover picture' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverPic?: string;

  @ApiPropertyOptional({ description: 'Bio of the profile' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ description: 'Location of the profile' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ description: 'Occupation of the profile' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  occupation?: string;

  @ApiPropertyOptional({ description: 'Interests of the profile' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  interests?: string;

  @ApiPropertyOptional({ description: 'Skills of the profile' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  skills?: string;
}
