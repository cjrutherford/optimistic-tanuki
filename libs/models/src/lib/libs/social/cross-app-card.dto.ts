import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CrossAppCardDto {
  @ApiProperty({ required: false, example: 'video-platform' })
  @IsOptional()
  @IsString()
  appId?: string;

  @ApiProperty({ required: false, example: 'MetroCast' })
  @IsOptional()
  @IsString()
  appName?: string;

  @ApiProperty({ required: false, example: 'channel-promotion' })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiProperty({ required: false, example: 'Watch Savannah Signal tonight' })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiProperty({ required: false, example: 'Watch on MetroCast' })
  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @ApiProperty({ required: false, example: '/c/savannah-signal' })
  @IsOptional()
  @IsString()
  targetPath?: string;

  @ApiProperty({ required: false, example: 'savannah-signal' })
  @IsOptional()
  @IsString()
  channelSlug?: string;

  @ApiProperty({ required: false, example: 'savannah-ga' })
  @IsOptional()
  @IsString()
  communitySlug?: string;
}
