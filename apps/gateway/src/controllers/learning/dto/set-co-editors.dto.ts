import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
} from 'class-validator';
import { CO_EDITOR_PROFILE_ID_MAX } from '@optimistic-tanuki/learning-domain';

export class SetCoEditorsDto {
  @ApiProperty({
    type: [String],
    maxItems: CO_EDITOR_PROFILE_ID_MAX,
    description: 'Learning profile UUIDs invited to edit this offering.',
  })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((profileId) =>
          typeof profileId === 'string' ? profileId.trim() : profileId
        )
      : value
  )
  @IsArray()
  @ArrayMaxSize(CO_EDITOR_PROFILE_ID_MAX)
  @ArrayUnique()
  @IsString({ each: true })
  @IsUUID(undefined, { each: true })
  coEditorProfileIds!: string[];
}
