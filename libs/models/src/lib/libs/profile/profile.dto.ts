import { ApiProperty } from '@nestjs/swagger';

export class ProfileDto {
  @ApiProperty({ description: 'Profile ID' })
  id: string;
  
  @ApiProperty({ description: 'Profile name' })
  profileName: string;
  
  @ApiProperty({ description: 'Email address' })
  email: string;
  
  @ApiProperty({ description: 'Biography' })
  bio: string;
  
  @ApiProperty({ description: 'Avatar URL' })
  avatarUrl: string;
  
  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
  
  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
  
  @ApiProperty({ description: 'Application scope' })
  appScope: string;
}
