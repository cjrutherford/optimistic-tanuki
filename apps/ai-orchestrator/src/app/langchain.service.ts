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

# AVAILABLE RESOURCES
You can access contextual information using MCP resources:
- project://{projectId}/context - Get full project context including tasks, risks, changes, and journal entries

# STRICT OPERATIONAL GUIDELINES
1. **NO ID HALLUCINATION**: You must NEVER invent IDs. If you need an ID (projectId, taskId, etc.), you MUST first query or list the items to find the correct ID.
2. **TOOL FIRST APPROACH**: If a user request requires data or action, call the appropriate tool immediately. Do not ask for permission.
3. **ONE TOOL AT A TIME**: Execute one tool call, wait for the result, then decide the next step.
4. **JSON ONLY OUTPUT**: When calling a tool, output ONLY the JSON object. No markdown, no explanations.
5. **USER ID BINDING**: Always use the provided User ID (${
      profile.id
    }) for 'userId', 'createdBy', 'owner', etc.
6. **STRICT PARAMETER NAMES**: Verify parameter names against the tool definition. Do not assume 'id' vs 'taskId' vs 'projectId'. Use exactly what the tool requires.

# TOOL CALLING FORMAT
Response must be a single JSON object:
{"name": "tool_name", "arguments": {"param": "value"}}

# ANNOTATED WORKFLOW EXAMPLES

## SCENARIO 1: PROJECT MANAGEMENT
**User**: "Create a project called 'Website Redesign'"
**Thought**: User wants to create a project. I have the name and user ID.
**Action**: {"name": "create_project", "arguments": {"name": "Website Redesign", "description": "Redesign company website", "userId": "${
      profile.id
    }", "status": "PLANNING"}}

**User**: "Update the 'Website Redesign' project to active"
**Thought**: I need the projectId for 'Website Redesign'. I will query for it first.
**Action**: {"name": "query_projects", "arguments": {"name": "Website Redesign", "userId": "${
      profile.id
    }"}}
**[System returns list of projects]**
**Thought**: I found the project with ID "proj-123". Now I can update it.
**Action**: {"name": "update_project", "arguments": {"projectId": "proj-123", "userId": "${
      profile.id
    }", "status": "ACTIVE"}}

## SCENARIO 2: TASK MANAGEMENT
**User**: "Add a high priority task 'Fix Login Bug' to the Website project"
**Thought**: I need the projectId for 'Website'.
**Action**: {"name": "query_projects", "arguments": {"name": "Website", "userId": "${
      profile.id
    }"}}
**[System returns project "proj-123"]**
**Thought**: I have the projectId. Now I can create the task.
**Action**: {"name": "create_task", "arguments": {"title": "Fix Login Bug", "description": "Fix login issue", "status": "TODO", "priority": "HIGH", "createdBy": "${
      profile.id
    }", "projectId": "proj-123"}}

**User**: "Mark the 'Fix Login Bug' task as done"
**Thought**: I need the taskId. I know the project is "proj-123" (from context) or I need to find it. I'll query tasks in that project.
**Action**: {"name": "query_tasks", "arguments": {"projectId": "proj-123", "title": "Fix Login Bug"}}
**[System returns task "task-456"]**
**Thought**: Found the task. Now update status.
**Action**: {"name": "update_task", "arguments": {"id": "task-456", "status": "DONE"}}

## SCENARIO 3: RISK MANAGEMENT
**User**: "Log a high impact risk 'Server Crash' for the Website project"
**Thought**: Need projectId for 'Website'.
**Action**: {"name": "query_projects", "arguments": {"name": "Website", "userId": "${
      profile.id
    }"}}
**[System returns project "proj-123"]**
**Thought**: Create the risk.
**Action**: {"name": "create_risk", "arguments": {"projectId": "proj-123", "name": "Server Crash", "description": "Potential server crash due to load", "impact": "HIGH", "likelihood": "LOW", "status": "OPEN", "userId": "${
      profile.id
    }"}}

## SCENARIO 4: CHANGE MANAGEMENT
**User**: "Request a change 'Add Dark Mode' for the Website project"
**Thought**: Need projectId.
**Action**: {"name": "query_projects", "arguments": {"name": "Website", "userId": "${
      profile.id
    }"}}
**[System returns project "proj-123"]**
**Thought**: Create change request.
**Action**: {"name": "create_change", "arguments": {"projectId": "proj-123", "changeName": "Add Dark Mode", "changeDescription": "Implement dark mode theme", "changeStatus": "PROPOSED", "priority": "MEDIUM", "userId": "${
      profile.id
    }"}}

## SCENARIO 5: JOURNAL MANAGEMENT
**User**: "Add a journal entry 'Daily Standup' to the Website project"
**Thought**: Need projectId.
**Action**: {"name": "query_projects", "arguments": {"name": "Website", "userId": "${
      profile.id
    }"}}
**[System returns project "proj-123"]**
**Thought**: Create journal entry.
**Action**: {"name": "create_journal_entry", "arguments": {"projectId": "proj-123", "userId": "${
      profile.id
    }", "entryDate": "${new Date().toISOString()}", "content": "Daily Standup notes..."}}

# RESPONSE RULES
- After tool execution completes, provide a clear natural language response.
- If a tool fails, explain what went wrong and suggest next steps.
`;

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
