import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class ResetPasswordRequest {
  @IsEmail()
  @ApiProperty()
  email!: string;

  @IsString()
  @ApiProperty()
  oldPass!: string;

  @IsString()
  @ApiProperty()
  newConf!: string;

  @IsString()
  @MinLength(8)
  @ApiProperty()
  newPass!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  mfa?: string;
}