import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PublicContactLeadIntakeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  @IsString()
  @MaxLength(80)
  appScope!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourcePage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  profileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  routingProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;
}
