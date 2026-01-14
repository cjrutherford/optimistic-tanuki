import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength } from 'class-validator';

export class RegisterRequest {
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
