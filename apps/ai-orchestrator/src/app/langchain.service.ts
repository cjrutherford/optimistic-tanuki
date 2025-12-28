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

  /**
   * Get available MCP resources for context building
   */
  private async getAvailableResources(): Promise<string> {
    try {
      const resources = await this.toolsService.listResources();
      if (!resources || resources.length === 0) {
        return 'No additional resources available.';
      }

      const resourceList = resources
        .map((r) => `- ${r.uri}: ${r.description || r.name}`)
        .join('\n');

      return `Available MCP Resources:\n${resourceList}`;
    } catch (error) {
      this.logger.warn('Failed to fetch MCP resources:', error);
      return 'Resources unavailable at this time.';
    }
  }

  /**
   * Get project context if projectId is mentioned in conversation
   */
  private async enrichWithProjectContext(
    conversationHistory: ChatMessage[],
    userMessage: string
  ): Promise<string> {
    try {
      // Check if conversation mentions a projectId
      const allText =
        conversationHistory.map((m) => m.content).join(' ') + ' ' + userMessage;
      const projectIdMatch =
        allText.match(/project[:\s]+([a-f0-9-]{36})/i) ||
        allText.match(/projectId[:\s"']+([a-f0-9-]{36})/i);

      if (projectIdMatch && projectIdMatch[1]) {
        const projectId = projectIdMatch[1];
        this.logger.log(`Detected projectId ${projectId}, fetching context...`);

        const context = await this.toolsService.getResource(
          `project://${projectId}/context`
        );
        if (
          context &&
          Array.isArray(context._meta?.contents) &&
          context._meta.contents.length > 0
        ) {
          const content = context._meta.contents[0];
          if (content.text) {
            return `\n\n# PROJECT CONTEXT\n${content.text}`;
          }
        }
      }
    } catch (error) {
      this.logger.debug(
        'No project context enrichment needed or error:',
        error
      );
    }

    return '';
  }

  private createSystemPrompt(
    persona: PersonaTelosDto,
    profile: ProfileDto,
    conversationSummary: string,
    projectContext?: string
  ): string {
    const basePrompt = `You are ${persona.name}, ${persona.description}

# USER CONTEXT
- User ID: ${profile.id}
- User Name: ${profile.profileName}

# CONVERSATION SUMMARY
${conversationSummary}

${projectContext || ''}

# TOOL DISCOVERY
You have access to tools through the MCP (Model Context Protocol) system. To discover what tools are available, call the 'list_tools' tool. This will show you all available tools with their exact parameter names and descriptions.

**IMPORTANT**: The available tools may change over time. Always use 'list_tools' when you're uncertain about:
- What tools are available
- What parameters a tool requires
- The exact parameter names to use

# AVAILABLE RESOURCES
You can access contextual information using MCP resources:
- project://{projectId}/context - Get full project context including tasks, risks, changes, and journal entries

# STRICT OPERATIONAL GUIDELINES
1. **TOOL DISCOVERY FIRST**: If uncertain about available actions, call 'list_tools' to see what you can do.
2. **NO ID HALLUCINATION**: You must NEVER invent IDs. If you need an ID (projectId, taskId, etc.), you MUST first query or list the items to find the correct ID.
3. **TOOL FIRST APPROACH**: If a user request requires data or action, call the appropriate tool immediately. Do not ask for permission.
4. **ONE TOOL AT A TIME**: Execute one tool call, wait for the result, then decide the next step.
5. **JSON ONLY OUTPUT**: When calling a tool, output ONLY the JSON object. No markdown, no explanations.
6. **USER ID BINDING**: Always use the provided User ID (${
      profile.id
    }) for 'userId', 'createdBy', 'owner', etc.
7. **EXACT PARAMETER NAMES**: Use the EXACT parameter names from the tool schema. The schemas are provided by 'list_tools' or bound to this conversation. Do NOT guess or assume parameter names.

# TOOL CALLING FORMAT
When calling a tool, output a single JSON object with this structure:
{"name": "tool_name", "arguments": {"param1": "value1", "param2": "value2"}}

Do NOT wrap in markdown code blocks. Do NOT add explanations before or after.

# EXAMPLE WORKFLOWS

## Discovering Available Tools
**User**: "What can you help me with?"
**Action**: {"name": "list_tools", "arguments": {}}
**[System returns list of all available tools]**
**Response**: "I can help you with: [summarize tools]"

## Creating Items That Require IDs
**User**: "Create a task called 'Fix Bug' in the Website project"
**Thought**: I need the projectId for 'Website'. I'll query for it first.
**Action**: {"name": "query_projects", "arguments": {"name": "Website", "userId": "${
      profile.id
    }"}}
**[System returns project with ID "proj-123"]**
**Thought**: I have the projectId. Now I can create the task.
**Action**: {"name": "create_task", "arguments": {"title": "Fix Bug", "projectId": "proj-123", "createdBy": "${
      profile.id
    }", "status": "TODO"}}

# RESPONSE RULES
- After tool execution completes, provide a clear natural language response.
- If a tool fails, explain what went wrong and suggest next steps.
- If you're uncertain about parameters, call 'list_tools' to verify.
`;

    return basePrompt;
  }

  private async createTools(
    userId: string,
    conversationId: string
  ): Promise<DynamicStructuredTool[]> {
    const mcpTools = await this.toolsService.listTools();
    
    // Create MCP tools
    const tools = mcpTools.map((tool) => {
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

    // Add list_tools as a LangChain tool so LLM can discover available tools
    const listToolsTool = new DynamicStructuredTool({
      name: 'list_tools',
      description: 'List all available tools with their descriptions and parameters. Call this when you need to discover what actions you can perform.',
      schema: z.object({}), // No parameters needed
      func: async () => {
        this.logger.log('LLM called list_tools to discover available actions');
        
        // Format tools in a way that's helpful for the LLM
        const toolDescriptions = mcpTools.map(tool => {
          const params = tool.inputSchema?.properties || {};
          const required = tool.inputSchema?.required || [];
          
          const paramList = Object.entries(params).map(([name, schema]: [string, any]) => {
            const isRequired = required.includes(name);
            const typeInfo = schema.type || 'any';
            const description = schema.description || '';
            return `  - ${name} (${typeInfo})${isRequired ? ' [REQUIRED]' : ' [optional]'}: ${description}`;
          }).join('\n');

          return `## ${tool.name}
Description: ${tool.description || 'No description'}
Parameters:
${paramList || '  (none)'}`;
        }).join('\n\n');

        return `Available Tools:\n\n${toolDescriptions}\n\nNote: Always use the exact parameter names shown above. Do NOT fabricate IDs - query/list first to get valid IDs.`;
      },
    });

    // Return all tools including list_tools
    return [listToolsTool, ...tools];
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
  ): Promise<{ 
    response: string; 
    intermediateSteps: any[];
    toolCalls?: Array<{ tool: string; input: unknown; output: unknown }>;
  }> {
    // Enrich with project context if available
    const projectContext = await this.enrichWithProjectContext(
      conversationHistory,
      userMessage
    );

    const systemPrompt = this.createSystemPrompt(
      persona,
      profile,
      conversationSummary,
      projectContext
    );
    const tools = await this.createTools(profile.id, conversationId);
    const chatHistory = this.convertChatHistory(conversationHistory);

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    // Bind tools to LLM so it knows what tools are available and their schemas
    const llmWithTools = this.llm.bindTools(tools);
    this.logger.log(`Executing conversation with ${tools.length} tools bound to LLM`);
    
    const response = await llmWithTools.invoke(messages);
    
    // Check if response contains tool calls
    const toolCallsToExecute: any[] = (response as any).tool_calls || [];
    const toolCalls: Array<{ tool: string; input: unknown; output: unknown }> = [];
    
    if (toolCallsToExecute.length > 0) {
      this.logger.log(`LLM requested ${toolCallsToExecute.length} tool calls`);
      
      // Execute each tool call
      for (const toolCall of toolCallsToExecute) {
        this.logger.log(`Executing tool: ${toolCall.name}`);
        
        try {
          // Convert to OpenAI format for MCP executor
          const openAIToolCall = {
            id: toolCall.id || `call_${Date.now()}`,
            type: 'function' as const,
            function: {
              name: toolCall.name,
              arguments: typeof toolCall.args === 'string' 
                ? toolCall.args 
                : JSON.stringify(toolCall.args),
            },
          };
          
          const context = {
            userId: profile.id,
            profileId: profile.id,
            conversationId,
            timestamp: new Date(),
          };
          
          const result = await this.mcpExecutor.executeToolCall(
            openAIToolCall,
            context
          );
          
          toolCalls.push({
            tool: toolCall.name,
            input: toolCall.args,
            output: result.result || result,
          });
          
          this.logger.log(`Tool ${toolCall.name} executed successfully`);
        } catch (error) {
          this.logger.error(`Tool ${toolCall.name} execution failed:`, error);
          toolCalls.push({
            tool: toolCall.name,
            input: toolCall.args,
            output: { error: error.message },
          });
        }
      }
      
      // If tools were called, get final response from LLM with tool results
      if (toolCalls.length > 0) {
        // Add tool results to conversation and get final response
        const toolResultMessages = toolCalls.map(tc => 
          new AIMessage(`Tool ${tc.tool} result: ${JSON.stringify(tc.output)}`)
        );
        
        const finalMessages = [...messages, response, ...toolResultMessages];
        const finalResponse = await llmWithTools.invoke(finalMessages);
        
        return { 
          response: finalResponse.content as string, 
          intermediateSteps: [],
          toolCalls 
        };
      }
    }
    
    // No tool calls, just return the response
    return { 
      response: response.content as string, 
      intermediateSteps: [],
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }

  async *streamConversation(
    persona: PersonaTelosDto,
    profile: ProfileDto,
    conversationHistory: ChatMessage[],
    userMessage: string,
    conversationSummary: string,
    conversationId: string
  ): AsyncGenerator<{ type: string; content: string }> {
    // Enrich with project context if available
    const projectContext = await this.enrichWithProjectContext(
      conversationHistory,
      userMessage
    );

    const systemPrompt = this.createSystemPrompt(
      persona,
      profile,
      conversationSummary,
      projectContext
    );
    const tools = await this.createTools(profile.id, conversationId);
    const chatHistory = this.convertChatHistory(conversationHistory);

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    // Bind tools to LLM so it knows what tools are available and their schemas
    const llmWithTools = this.llm.bindTools(tools);
    this.logger.log(`Streaming conversation with ${tools.length} tools bound to LLM`);
    
    const stream = await llmWithTools.stream(messages);
    let fullResponse = '';

    // Stream chunks in real-time instead of accumulating
    for await (const chunk of stream) {
      if (chunk.content) {
        const contentStr = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
        fullResponse += contentStr;
        
        // Yield each chunk immediately for real-time updates
        yield { type: 'chunk', content: contentStr };
      }
    }

    // Final yield with complete response
    yield { type: 'final_response', content: fullResponse };
  }
}
