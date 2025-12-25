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
      
      const resourceList = resources.map(r => 
        `- ${r.uri}: ${r.description || r.name}`
      ).join('\n');
      
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
      const allText = conversationHistory.map(m => m.content).join(' ') + ' ' + userMessage;
      const projectIdMatch = allText.match(/project[:\s]+([a-f0-9-]{36})/i) || 
                            allText.match(/projectId[:\s"']+([a-f0-9-]{36})/i);
      
      if (projectIdMatch && projectIdMatch[1]) {
        const projectId = projectIdMatch[1];
        this.logger.log(`Detected projectId ${projectId}, fetching context...`);
        
        const context = await this.toolsService.getResource(`project://${projectId}/context`);
        if (context && context.contents && context.contents.length > 0) {
          const content = context.contents[0];
          if (content.text) {
            return `\n\n# PROJECT CONTEXT\n${content.text}`;
          }
        }
      }
    } catch (error) {
      this.logger.debug('No project context enrichment needed or error:', error);
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

# AVAILABLE RESOURCES
You can access contextual information using MCP resources:
- project://{projectId}/context - Get full project context including tasks, risks, changes, and journal entries

# TOOL CALLING RULES
- When you need to call a tool, respond with ONLY a JSON object in this exact format:
  {"name": "tool_name", "arguments": {"param1": "value1", "param2": "value2"}}
- Do NOT wrap the JSON in markdown code blocks or add any other text
- Do NOT use explanatory text before or after the JSON
- Alternative formats also supported:
  * XML: <tool_call><name>tool_name</name><arguments><param>value</param></arguments></tool_call>
  * OpenAI: {"type": "function", "function": {"name": "tool_name", "arguments": "{\\"param\\": \\"value\\"}"}}

# TOOL USAGE EXAMPLES

## Example 1: List Projects (ALWAYS do this first when working with projects)
User: "Show me my projects"
Response: {"name": "list_projects", "arguments": {"userId": "${profile.id}"}}

## Example 2: Create a Project
User: "Create a project called 'Website Redesign'"
Response: {"name": "create_project", "arguments": {"name": "Website Redesign", "description": "Redesign company website", "userId": "${profile.id}", "status": "PLANNING"}}

## Example 3: Create a Task (MUST get projectId from list_projects first)
User: "Add a task to review the homepage"
Step 1: {"name": "list_projects", "arguments": {"userId": "${profile.id}"}}
[Wait for result with projectId]
Step 2: {"name": "create_task", "arguments": {"title": "Review homepage", "description": "Review and provide feedback on homepage design", "status": "TODO", "priority": "HIGH", "createdBy": "${profile.id}", "projectId": "<projectId_from_step1>"}}

## Example 4: Get Project Details
User: "Tell me about project abc-123"
Response: {"name": "get_project", "arguments": {"projectId": "abc-123"}}

## Example 5: List Tasks for a Project
User: "What tasks are in my project?"
Step 1: {"name": "list_projects", "arguments": {"userId": "${profile.id}"}}
[Wait for result]
Step 2: {"name": "list_tasks", "arguments": {"projectId": "<projectId_from_step1>"}}

## Example 6: Update Task Status
User: "Mark task xyz as done"
Response: {"name": "update_task", "arguments": {"id": "xyz", "status": "DONE"}}

## Example 7: Create Risk Assessment
User: "Add a risk about budget overruns"
Step 1: {"name": "list_projects", "arguments": {"userId": "${profile.id}"}}
[Wait for result]
Step 2: {"name": "create_risk", "arguments": {"projectId": "<projectId_from_step1>", "title": "Budget Overrun Risk", "description": "Project may exceed allocated budget", "impact": "HIGH", "probability": "MEDIUM", "createdBy": "${profile.id}"}}

## Example 8: Create Change Request
User: "Log a change to add mobile support"
Step 1: {"name": "list_projects", "arguments": {"userId": "${profile.id}"}}
[Wait for result]
Step 2: {"name": "create_change", "arguments": {"projectId": "<projectId_from_step1>", "title": "Add Mobile Support", "description": "Implement responsive design for mobile devices", "requestedBy": "${profile.id}", "status": "PENDING"}}

# KEY RULES FOR TOOL USAGE
1. ALWAYS call list_projects with userId=${profile.id} FIRST when you need a projectId
2. Use the EXACT projectId from list_projects response - do NOT make up IDs
3. For createdBy/requestedBy/userId parameters, ALWAYS use: ${profile.id}
4. Call ONE tool at a time and wait for the response
5. After tool execution, provide a natural language summary of what happened

# RESPONSE RULES
- After tool execution completes, provide a clear natural language response
- For final responses (not tool calls), use conversational language
- If a tool fails, explain what went wrong and suggest next steps`;

    return basePrompt;
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
