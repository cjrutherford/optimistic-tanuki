import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class UpdateFollowDto {
  @ApiProperty({ description: 'Follower user ID' })
  @IsUUID()
  followerId!: string;

  @ApiProperty({ description: 'Followee user ID' })
  @IsUUID()
  followeeId!: string;
}

export class QueryFollowsDto {
  @ApiPropertyOptional({ description: 'Follower user ID' })
  @IsOptional()
  @IsUUID()
  followerId?: string;

  @ApiPropertyOptional({ description: 'Followee user ID' })
  @IsOptional()
  @IsUUID()
  followeeId?: string;

  @ApiPropertyOptional({ description: 'Filter for mutual follows' })
  @IsOptional()
  @IsBoolean()
  isMutual?: boolean;
}
