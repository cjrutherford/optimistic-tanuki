import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { OAuthProvider } from './OAuthCallbackRequest';

export class UnlinkProviderRequest {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The user ID to unlink the provider from' })
  userId!: string;

  @IsEnum(OAuthProvider)
  @ApiProperty({ enum: OAuthProvider, description: 'The OAuth provider to unlink' })
  provider!: OAuthProvider;
}
