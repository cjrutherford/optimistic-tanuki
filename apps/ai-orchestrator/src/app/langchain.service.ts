/**
 * LangChain Service for AI Orchestration
 *
 * Replaces custom prompt engineering with LangChain.js
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  ChatMessage,
  PersonaTelosDto,
  ProfileDto,
  ToolResult,
} from '@optimistic-tanuki/models';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ToolsService } from './tools.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);
  private llm: ChatOllama;

  constructor(
    private readonly toolsService: ToolsService,
    private readonly mcpExecutor: MCPToolExecutor,
    private readonly config: ConfigService
  ) {
    const ollama = this.config.get<{ host: string; port: number }>('ollama');
    this.llm = new ChatOllama({
      model: 'qwen3-coder',
      baseUrl:
        ollama.host && ollama.port
          ? `http://${ollama.host}:${ollama.port}`
          : 'http://prompt-proxy:11434',
      temperature: 0.7,
    });
  }

  private createSystemPrompt(
    persona: PersonaTelosDto,
    profile: ProfileDto,
    conversationSummary: string
  ): string {
    return `You are ${persona.name}, ${persona.description}

# USER CONTEXT
- User ID: ${profile.id}
- User Name: ${profile.profileName}

# CONVERSATION SUMMARY
${conversationSummary}

# TOOL CALLING RULES
- When you need to call a tool, respond with ONLY a JSON object in this exact format:
  {"name": "tool_name", "arguments": {"param1": "value1", "param2": "value2"}}
- Do NOT wrap the JSON in markdown code blocks or add any other text
- Do NOT use explanatory text before or after the JSON
- Alternative formats also supported:
  * XML: <tool_call><name>tool_name</name><arguments><param>value</param></arguments></tool_call>
  * OpenAI: {"type": "function", "function": {"name": "tool_name", "arguments": "{\\"param\\": \\"value\\"}"}}

# RESPONSE RULES
- Always use userId/profileId = ${profile.id} in tool calls
- Use ONE tool per response
- After tool execution completes, provide a clear natural language response
- For final responses (not tool calls), use conversational language`;
  }

  private async createTools(
    userId: string,
    conversationId: string
  ): Promise<DynamicStructuredTool[]> {
    const mcpTools = await this.toolsService.listTools();
    return mcpTools.map((tool) => {
      const schema = this.convertToZodSchema(tool.inputSchema);
      return new DynamicStructuredTool({
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        schema,
        func: async (input: any) => {
          const enrichedInput = { ...input, userId, profileId: userId };
          const toolCall = {
            id: `lc_${Date.now()}`,
            type: 'function' as const,
            function: {
              name: tool.name,
              arguments: JSON.stringify(enrichedInput),
            },
          };
          const result: ToolResult = await this.mcpExecutor.executeToolCall(
            toolCall,
            { userId, profileId: userId, conversationId }
          );
          if (result.success) {
            return typeof result.result === 'string'
              ? result.result
              : JSON.stringify(result.result);
          }
          throw new Error(result.error?.message || 'Tool failed');
        },
      });
    });
  }

  private convertToZodSchema(jsonSchema: any): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};
    if (jsonSchema.properties) {
      for (const [key, prop] of Object.entries(
        jsonSchema.properties as Record<string, any>
      )) {
        let zodType: z.ZodTypeAny = z.any();
        if (prop.type === 'string') zodType = z.string();
        else if (prop.type === 'number' || prop.type === 'integer')
          zodType = z.number();
        else if (prop.type === 'boolean') zodType = z.boolean();
        else if (prop.type === 'array') zodType = z.array(z.any());
        else if (prop.type === 'object') zodType = z.object({}).passthrough();

        if (prop.description) zodType = zodType.describe(prop.description);
        if (!jsonSchema.required || !jsonSchema.required.includes(key))
          zodType = zodType.optional();
        shape[key] = zodType;
      }
    }
    return z.object(shape);
  }

  private convertChatHistory(messages: ChatMessage[]): BaseMessage[] {
    return messages.map((msg) => {
      const isUser =
        msg.role === 'user' ||
        (msg.type === 'chat' && msg.senderId !== msg.recipientId?.[0]);
      if (isUser) return new HumanMessage(msg.content);
      if (msg.role === 'assistant') return new AIMessage(msg.content);
      return new SystemMessage(msg.content);
    });
  }

  async executeConversation(
    persona: PersonaTelosDto,
    profile: ProfileDto,
    conversationHistory: ChatMessage[],
    userMessage: string,
    conversationSummary: string,
    conversationId: string
  ): Promise<{ response: string; intermediateSteps: any[] }> {
    const systemPrompt = this.createSystemPrompt(
      persona,
      profile,
      conversationSummary
    );
    const tools = await this.createTools(profile.id, conversationId);
    const chatHistory = this.convertChatHistory(conversationHistory);

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    // Simple invoke without tool binding for now
    const response = await this.llm.invoke(messages);
    return { response: response.content as string, intermediateSteps: [] };
  }

  async *streamConversation(
    persona: PersonaTelosDto,
    profile: ProfileDto,
    conversationHistory: ChatMessage[],
    userMessage: string,
    conversationSummary: string,
    conversationId: string
  ): AsyncGenerator<{ type: string; content: string }> {
    const systemPrompt = this.createSystemPrompt(
      persona,
      profile,
      conversationSummary
    );
    const chatHistory = this.convertChatHistory(conversationHistory);

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    const stream = await this.llm.stream(messages);
    let fullResponse = '';

    for await (const chunk of stream) {
      if (chunk.content) {
        fullResponse += chunk.content;
      }
    }

    yield { type: 'final_response', content: fullResponse };
  }
}
