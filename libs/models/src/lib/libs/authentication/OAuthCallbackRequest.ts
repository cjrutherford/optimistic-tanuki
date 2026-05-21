import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum OAuthProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
  MICROSOFT = 'microsoft',
  FACEBOOK = 'facebook',
  CUSTOM = 'custom',
}

export class OAuthCallbackRequest {
  @IsEnum(OAuthProvider)
  @ApiProperty({ enum: OAuthProvider, description: 'The OAuth provider name' })
  provider!: OAuthProvider;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The authorization code from the OAuth provider' })
  code!: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'The state parameter for CSRF protection' })
  state?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'The redirect URI used in the OAuth flow' })
  redirectUri?: string;
}
