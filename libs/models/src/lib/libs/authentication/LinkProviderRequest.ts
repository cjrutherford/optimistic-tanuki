import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
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
  @ApiPropertyOptional({
    description: 'The email from the OAuth provider profile',
  })
  providerEmail?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'The display name from the OAuth provider profile',
  })
  providerDisplayName?: string;

  /**
   * Trusted gateway-only assertion from a provider's verified-email claim.
   * Authentication checks that it matches the platform account before using it.
   */
  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Whether the provider attested that providerEmail is verified',
  })
  providerEmailVerified?: boolean;
}
