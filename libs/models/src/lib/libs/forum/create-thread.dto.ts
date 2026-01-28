import { ApiProperty } from '@nestjs/swagger';
import {

IsBoolean,
IsIn,
IsNotEmpty,
IsOptional,
IsString,
} from 'class-validator';

export class CreateThreadDto {
@IsString()
@IsNotEmpty()
@ApiProperty({ description: 'The title of the thread' })
title: string;

@IsString()
@IsNotEmpty()
@ApiProperty({ description: 'The content of the thread' })
content: string;

@IsString()
@IsOptional()
@ApiProperty({ description: 'The ID of the user creating the thread' })
userId?: string;

@IsString()
@IsNotEmpty()
@ApiProperty({ description: 'The ID of the profile creating the thread' })
profileId: string;

@IsString()
@IsNotEmpty()
@ApiProperty({ description: 'The ID of the topic this thread belongs to' })
topicId: string;

@IsString()
@IsOptional()
@IsIn(['public', 'private'])
@ApiProperty({ description: 'Visibility of the thread', required: false })
visibility?: 'public' | 'private';

@IsBoolean()
@IsOptional()
@ApiProperty({ description: 'Whether the thread is pinned', required: false })
isPinned?: boolean;

@IsBoolean()
@IsOptional()
@ApiProperty({ description: 'Whether the thread is locked', required: false })
isLocked?: boolean;

@IsString()
@IsOptional()
@ApiProperty({
  description: 'App scope for the thread',
  required: false,
  example: 'forum',
})
appScope?: string;
}
