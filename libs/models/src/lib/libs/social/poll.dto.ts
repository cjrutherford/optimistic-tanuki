import {
  IsString,
  IsArray,
  IsBoolean,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreatePollDto {
  @IsString()
  question: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsOptional()
  @IsBoolean()
  isMultipleChoice?: boolean;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  showResultsBeforeVote?: boolean;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsString()
  profileId: string;

  @IsString()
  userId: string;
}

export class UpdatePollDto {
  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  isMultipleChoice?: boolean;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  showResultsBeforeVote?: boolean;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class VotePollDto {
  @IsString()
  pollId: string;

  @IsString()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  optionIndices: number[];
}

export class PollDto {
  id: string;
  question: string;
  options: string[];
  votes: string[];
  isMultipleChoice: boolean;
  endsAt: Date | null;
  showResultsBeforeVote: boolean;
  isAnonymous: boolean;
  profileId: string;
  isActive: boolean;
  createdAt: Date;
}

export class PollWithResultsDto extends PollDto {
  totalVotes: number;
  optionResults: { option: string; count: number; percentage: number }[];
  userVoted: boolean;
  userVoteOptions: number[];
}
