import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  MinLength,
  IsUUID,
} from 'class-validator';

export class CreateProfileDto {
  @ApiProperty({
    required: false,
    description: 'Name of the profile',
    example: 'John Doe',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Description of the profile',
    example: 'Software Developer',
  })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ description: 'User ID associated with the profile' })
  @IsString()
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'URL of the profile picture' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  profilePic!: string;

  @ApiProperty({ required: false, description: 'URL of the cover picture' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverPic!: string;

  @ApiProperty({ required: false, description: 'Bio of the profile' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio!: string;

  @ApiProperty({
    required: false,
    description: 'Location of the profile',
    example: 'San Francisco, CA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location!: string;

  @ApiProperty({
    required: false,
    description: 'Occupation of the profile',
    example: 'Software Engineer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  occupation!: string;

  @ApiProperty({
    required: false,
    description: 'Interests of the profile',
    example: 'Coding, Hiking, Reading',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  interests!: string;

  @ApiProperty({
    required: false,
    description: 'Skills of the profile',
    example: 'JavaScript, Python, Docker',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  skills!: string;
}
