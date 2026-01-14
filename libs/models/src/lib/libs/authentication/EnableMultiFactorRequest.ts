import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class EnableMultiFactorRequest {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  initialTotp!: string;
}
