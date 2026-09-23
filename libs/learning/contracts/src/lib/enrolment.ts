import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** `LearningCommands.Enrol` and `Withdraw` share this shape. */
export class EnrolmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  offeringId!: string;
}

export class EnrolDto extends EnrolmentDto {}

export class WithdrawDto extends EnrolmentDto {}

/** `LearningCommands.ListMyEnrolments` and `GetProgress`. */
export class ProfileEnrolmentsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;
}
