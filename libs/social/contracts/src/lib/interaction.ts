import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export enum PresenceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
}

/** `PollCommands.CREATE` — mirrors `apps/social/src/entities/poll.entity.ts`. */
export class CreatePollDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMultipleChoice?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endsAt?: Date;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

/** `PollCommands.VOTE` — option indexes into the poll's `options` array. */
export class VotePollDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pollId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty({ type: [Number] })
  @IsArray()
  optionIndexes!: number[];
}

/** `PostShareCommands.CREATE`. */
export class SharePostDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  postId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

/** `PresenceCommands.SET_PRESENCE`. */
export class SetPresenceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: PresenceStatus })
  @IsEnum(PresenceStatus)
  status!: PresenceStatus;
}

/** `PresenceCommands.GET_PRESENCE`. */
export class GetPresenceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
