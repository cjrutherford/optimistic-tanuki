import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './create-profile.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateProfileDto extends PartialType(CreateProfileDto) {
  @ApiProperty({ description: 'ID of the profile' })
  @IsUUID()
  id!: string;
}
