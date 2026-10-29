import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

const VISIBILITIES = ['public', 'followers'] as const;

export class CreateGuardianPostDto {
  @IsString()
  @Length(1, 500)
  title!: string;

  @IsString()
  @Length(1, 50000)
  content!: string;

  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  publishAssetIds?: string[];
}

export class UpdateGuardianPostDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50000)
  content?: string;

  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  publishAssetIds?: string[];
}

export class CreateGuardianCommentDto {
  @IsString()
  @Length(1, 10000)
  content!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  publishAssetIds?: string[];
}

export class UpdateGuardianCommentDto {
  @IsOptional()
  @IsString()
  @Length(1, 10000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  publishAssetIds?: string[];
}
