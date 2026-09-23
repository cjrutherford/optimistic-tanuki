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

/**
 * Canonical message type shared by chat-collector persistence, the social
 * message projections (E12), and AI-orchestrated flows (E13). Replaces the
 * duplicated `MessageType` enums in
 * `apps/chat-collector/src/app/entities/message.entity.ts` and
 * `apps/social/src/entities/chat-message.entity.ts`.
 */
export enum MessageType {
  CHAT = 'chat',
  INFO = 'info',
  WARNING = 'warning',
  SYSTEM = 'system',
}

export class ChatMessageDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senderId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  recipientIds!: string[];

  @ApiProperty({ enum: MessageType, default: MessageType.CHAT })
  @IsEnum(MessageType)
  type!: MessageType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isEdited?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAt?: Date;
}

/**
 * Payload for `ChatCommands.POST_MESSAGE` (chat-collector persistence) —
 * the full wire shape producers send.
 */
export class PostMessageDto extends ChatMessageDto {}

/**
 * Payload for `ChatCommands.SEND_MESSAGE` (gateway `POST /api/chat/messages`) —
 * the sender comes from the session, so it is omitted here and filled by the
 * gateway handler.
 */
export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  recipientIds!: string[];
}
