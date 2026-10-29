import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class RegisterRequest {
  @IsOptional()
  @IsDateString()
  @ApiProperty({
    required: false,
    description:
      'Private age-eligibility input; never copied to the public profile.',
  })
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'One-time applicant resume secret after guardian attestation.',
  })
  guardianResumeToken?: string;

  /** Gateway-computed internal status; never trust this from HTTP input. */
  ageEligibilityStatus?: 'adult' | 'minor';

  @IsString()
  @ApiProperty({
    description: 'First Name of the user.',
  })
  fn!: string;

  @IsString()
  @ApiProperty({
    description: 'Last Name of the user.',
  })
  ln!: string;

  @IsEmail()
  @ApiProperty({
    description: 'Email of the user.',
  })
  email!: string;

  @IsString()
  @MinLength(8)
  @ApiProperty({
    description: 'Password of the user.',
  })
  password!: string;

  @IsString()
  @ApiProperty({
    description: 'password confirmation for the user.',
  })
  confirm!: string;

  @IsString()
  @ApiProperty({
    description: 'user biography',
  })
  bio!: string;
}
