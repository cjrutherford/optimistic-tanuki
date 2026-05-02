import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { OAuthProvider } from './OAuthCallbackRequest';

export class LinkProviderRequest {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The user ID to link the provider to' })
  userId!: string;

  @IsEnum(OAuthProvider)
  @ApiProperty({ enum: OAuthProvider, description: 'The OAuth provider name' })
  provider!: OAuthProvider;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The provider-specific user ID' })
  providerUserId!: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'The provider access token' })
  accessToken?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'The provider refresh token' })
  refreshToken?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'The email from the OAuth provider profile' })
  providerEmail?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'The display name from the OAuth provider profile' })
  providerDisplayName?: string;
}
