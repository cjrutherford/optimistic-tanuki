export class PromptSendDto {
  system: string;
  prompt: string;
  userId: string;
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
  model: string;
  messages: OpenAIMessage[] | { role: string; content: string; [key: string]: any }[];
  tools?: any[];
  suffix?: string;
  format?: 'json';
  options?: Record<string, any>;
  system?: string;
  context?: string;
  stream?: boolean;
}
