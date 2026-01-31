import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ description: 'Channel name', example: 'My Gaming Channel' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Channel description',
    example: 'Gaming videos and tutorials',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Profile ID of the channel owner' })
  @IsString()
  @IsUUID()
  profileId: string;

  @ApiProperty({ description: 'User ID of the channel owner' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Banner asset ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  bannerAssetId?: string;

  @ApiProperty({
    description: 'Avatar asset ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  avatarAssetId?: string;
}

export class UpdateChannelDto {
  @ApiProperty({ description: 'Channel name', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'Channel description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Banner asset ID', required: false })
  @IsOptional()
  @IsUUID()
  bannerAssetId?: string;

  @ApiProperty({ description: 'Avatar asset ID', required: false })
  @IsOptional()
  @IsUUID()
  avatarAssetId?: string;
}

export class ChannelDto {
  @ApiProperty({ description: 'Channel ID' })
  id: string;

  @ApiProperty({ description: 'Channel name' })
  name: string;

  @ApiProperty({ description: 'Channel description' })
  description?: string;

  @ApiProperty({ description: 'Profile ID' })
  profileId: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Banner asset ID' })
  bannerAssetId?: string;

  @ApiProperty({ description: 'Avatar asset ID' })
  avatarAssetId?: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;
}
