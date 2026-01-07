import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsBoolean, IsObject, IsEnum } from 'class-validator';

export class PromptSendDto {
  @ApiProperty()
  @IsString()
  system!: string;

  @ApiProperty()
  @IsString()
  prompt!: string;

  @ApiProperty()
  @IsString()
  userId!: string;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

export class GeneratePrompt {
  @ApiProperty()
  @IsString()
  model!: string;

  @ApiProperty()
  @IsArray()
  messages!: OpenAIMessage[] | { role: string; content: string; [key: string]: any }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tools?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suffix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString() // Or enum if strict
  format?: 'json';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  options?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  system?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}
