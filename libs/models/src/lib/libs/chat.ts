import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessage {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  conversationId!: string;

  @ApiProperty()
  @IsString()
  senderName!: string;

  @ApiProperty()
  @IsString()
  senderId!: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  recipientId!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  recipientName!: string[];

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  timestamp!: Date;

  @ApiProperty({ enum: ['assistant', 'user', 'tool', 'system'] })
  @IsEnum(['assistant', 'user', 'tool', 'system'])
  role!: 'assistant' | 'user' | 'tool' | 'system';

  @ApiProperty({ enum: ['chat', 'info', 'warning', 'system'] })
  @IsEnum(['chat', 'info', 'warning', 'system'])
  type!: 'chat' | 'info' | 'warning' | 'system';
}

export class ChatConversation {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  participants!: string[]; // Array of user IDs

  @ApiProperty({ type: [ChatMessage] })
  @IsArray()
  @Type(() => ChatMessage)
  messages!: ChatMessage[];

  @ApiProperty({ enum: ['public', 'private', 'team'] })
  @IsEnum(['public', 'private', 'team'])
  privacy!: 'public' | 'private' | 'team';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  updatedAt!: Date;

  constructor(
    id: string,
    participants: string[],
    privacy: 'public' | 'private' | 'team' = 'private'
  ) {
    this.id = id;
    this.participants = participants;
    this.privacy = privacy;
    this.messages = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  addMessage(message: ChatMessage) {
    this.messages.push(message);
    this.updatedAt = new Date();
  }
}
