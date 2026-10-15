import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export const GuardianProfileFields = [
  'name',
  'profilePic',
  'coverPic',
  'bio',
  'location',
  'occupation',
  'interests',
  'skills',
] as const;

export type GuardianProfileField = (typeof GuardianProfileFields)[number];
export type GuardianProfileUpdates = Partial<
  Record<GuardianProfileField, string | null>
>;

/** Internal gateway-to-profile request. Dependent owner is always resolved by profile service. */
export class GuardianProfileRequestDto {
  @ApiProperty()
  @IsUUID()
  profileId!: string;

  @ApiProperty()
  @IsUUID()
  actorUserId!: string;

  @ApiProperty({ enum: ['client-interface', 'local-hub'] })
  @IsIn(['client-interface', 'local-hub'])
  appId!: string;

  @ApiProperty({ enum: ['profile.view', 'profile.manage'] })
  @IsIn(['profile.view', 'profile.manage'])
  operation!: 'profile.view' | 'profile.manage';

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  updates?: GuardianProfileUpdates;
}
