import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';

export class LoginRequest {

  @IsEmail()
  @ApiProperty()
  email!: string;
  
  @IsString()
  @MinLength(10)
  @ApiProperty()
  password!: string;
  
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ default: false })
  mfa?: string;

}
