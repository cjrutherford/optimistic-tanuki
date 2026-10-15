import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AssetType } from '@optimistic-tanuki/models';

/** Public guardian upload fields; ownership and authorization come from the route/session. */
export class CreateGuardianAssetDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsEnum(AssetType)
  type!: AssetType;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  fileExtension?: string;
}
