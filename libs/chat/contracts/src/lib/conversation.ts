import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Canonical conversation type shared by chat-collector persistence and every
 * TCP/REST consumer. Replaces the `ConversationType` enum in
 * `apps/chat-collector/src/app/entities/conversation.entity.ts`.
 */
export enum ConversationType {
  DIRECT = 'direct',
  COMMUNITY = 'community',
  PROJECT = 'project',
}

export class ConversationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: ConversationType })
  @IsEnum(ConversationType)
  type!: ConversationType;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  participants!: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  communityId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAt?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  updatedAt?: Date;
}

/** `ChatCommands.GET_CONVERSATIONS` — gateway `GET /api/chat/conversations/find`. */
export class GetConversationsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;
}

/** `ChatCommands.GET_CONVERSATION` — gateway `GET /api/chat/conversations/id/:id`. */
export class GetConversationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  conversationId!: string;
}

/** `ChatCommands.GET_MESSAGES` — gateway `GET /api/chat/messages/:conversationId`. */
export class GetMessagesDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  requestingProfileId?: string;
}

/**
 * Gateway REST body for `POST /api/chat/conversations/direct/get-or-create`.
 * The recipient is resolved and scope-checked against the profile service;
 * the TCP command itself carries `GetOrCreateDirectChatDto.participantIds`.
 */
export class GetOrCreateDirectChatBodyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recipientProfileId!: string;
}

/**
 * `ChatCommands.GET_OR_CREATE_DIRECT_CHAT` — gateway
 * `POST /api/chat/conversations/direct/get-or-create`. The service requires
 * exactly two participants; the DTO enforces the size, the service enforces
 * distinctness.
 */
export class GetOrCreateDirectChatDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  participantIds!: string[];
}

/** `ChatCommands.CREATE_COMMUNITY_CHAT` — gateway `POST /api/chat/conversations/community`. */
export class CreateCommunityChatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;
}

/** `ChatCommands.GET_OR_CREATE_PROJECT_CHAT` — project-chat provisioning. */
export class GetOrCreateProjectChatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  participants!: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;
}
