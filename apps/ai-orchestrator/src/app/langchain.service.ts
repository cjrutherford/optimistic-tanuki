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
import { ChatPromptTemplate } from '@langchain/core/prompts';
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
import {
  generateCoreSystemPrompt,
  generateToolingGuidance,
} from './utils/prompt-engineering';

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
      model: 'bjoernb/deepseek-r1-8b',
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

  private createSystemPromptTemplate(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are {personaName}, {personaDescription}

# USER CONTEXT
- User ID: {userId}
- User Name: {userName}

# CONVERSATION SUMMARY
{conversationSummary}

{projectContext}

# TOOL DISCOVERY
You have access to tools through the MCP (Model Context Protocol) system. To discover what tools are available, call the 'list_tools' tool. This will show you all available tools with their exact parameter names and descriptions.

**IMPORTANT**: The available tools may change over time. Always use 'list_tools' when you're uncertain about:
- What tools are available
- What parameters a tool requires
- The exact parameter names to use

# AVAILABLE RESOURCES
You can access contextual information using MCP resources:
- project://{{projectId}}/context - Get full project context including tasks, risks, changes, and journal entries

# DATA RELATIONSHIPS & CRITICAL PARAMETER MAPPINGS

## User Identity Parameters
- **userId** or **createdBy**: ALWAYS use '{userId}' (the current user's profile ID)
- **profileId**: SAME as userId - use '{userId}'
- **owner**: SAME as userId - use '{userId}'

## Project Management Entities
1. **Project**: Container identified by UUID (e.g., "a1b2c3d4-e5f6-...")
   - To GET project ID: Use list_projects or query_projects FIRST
   - Parameters: name, description, userId, status, startDate, members
   - Status values: PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED

2. **Task**: Work item belonging to a Project
   - REQUIRED: title, createdBy (use '{userId}'), projectId (from list/query)
   - OPTIONAL: description, status, priority
   - Status values: TODO, IN_PROGRESS, DONE, ARCHIVED
   - Priority values: LOW, MEDIUM_LOW, MEDIUM, MEDIUM_HIGH, HIGH

3. **Risk**: Risk assessment belonging to a Project
   - REQUIRED: projectId, title, likelihood, impact, createdBy
   - Parameters match risk_mcp service schemas

4. **Change**: Change request belonging to a Project
   - REQUIRED: projectId, title, description, createdBy
   - Parameters match change_mcp service schemas

## ID Resolution Workflow (CRITICAL)
NEVER fabricate or guess IDs. ALWAYS follow this pattern:

1. **Need projectId?**
   - Step 1: Call list_projects with userId: '{userId}'
   - Step 2: Extract the 'id' field from returned project
   - Step 3: Use that exact ID in subsequent calls

2. **Need taskId/riskId/changeId?**
   - Step 1: Call list_tasks/list_risks/list_changes with projectId
   - Step 2: Extract the 'id' field from returned items
   - Step 3: Use that exact ID in subsequent calls

# STRICT OPERATIONAL GUIDELINES
1. **TOOL DISCOVERY FIRST**: If uncertain about available actions, call 'list_tools' to see what you can do.
2. **NO ID HALLUCINATION**: You must NEVER invent IDs. If you need an ID (projectId, taskId, etc.), you MUST first query or list the items to find the correct ID. **If you don't have an ID, call a tool to find it.**
3. **TOOL FIRST APPROACH**: If a user request requires data or action, call the appropriate tool immediately. Do not ask for permission.
4. **ONE TOOL AT A TIME**: Execute one tool call, wait for the result, then decide the next step.
5. **JSON ONLY OUTPUT**: When calling a tool, output ONLY the JSON object. No markdown, no explanations.
6. **USER ID BINDING**: Always use the provided User ID ({userId}) for 'userId', 'createdBy', 'owner', etc.
7. **EXACT PARAMETER NAMES**: Use the EXACT parameter names from the tool schema. The schemas are provided by 'list_tools' or bound to this conversation. Do NOT guess or assume parameter names.
8. **CONTEXT-AWARE IDs**: Check conversation summary and project context for previously mentioned IDs before querying.

# TOOL CALLING FORMAT
When calling a tool, output a single JSON object with this structure:
{{"name": "tool_name", "arguments": {{"param1": "value1", "param2": "value2"}}}}

Do NOT wrap in markdown code blocks. Do NOT add explanations before or after.

# EXAMPLE WORKFLOWS WITH PROJECT MANAGEMENT TOOLS

## Example 1: Create Project (Simple)
**User**: "Create a new project called 'Website Redesign' for planning our site update"
**Action**: {{"name": "create_project", "arguments": {{"name": "Website Redesign", "description": "Planning our site update", "userId": "{userId}", "status": "PLANNING"}}}}
**Response**: "I've created the 'Website Redesign' project. It's now in PLANNING status."

## Example 2: Create Task (Requires Project ID Resolution)
**User**: "Add a task 'Update homepage' to the Website Redesign project"
**Step 1 - Get projectId**: {{"name": "query_projects", "arguments": {{"name": "Website Redesign", "userId": "{userId}"}}}}
**[Returns]: {{"success": true, "projects": [{{"id": "a1b2c3d4-e5f6-...", "name": "Website Redesign", ...}}]}}
**Step 2 - Create task**: {{"name": "create_task", "arguments": {{"title": "Update homepage", "projectId": "a1b2c3d4-e5f6-...", "createdBy": "{userId}", "status": "TODO", "priority": "MEDIUM"}}}}
**Response**: "I've added the task 'Update homepage' to your Website Redesign project."

## Example 3: List and Update Task
**User**: "Mark the homepage update task as in progress"
**Step 1 - Find project**: {{"name": "query_projects", "arguments": {{"name": "Website Redesign", "userId": "{userId}"}}}}
**[Returns]: {{"projects": [{{"id": "a1b2c3d4-...", ...}}]}}
**Step 2 - List tasks**: {{"name": "list_tasks", "arguments": {{"projectId": "a1b2c3d4-..."}}}}
**[Returns]: {{"tasks": [{{"id": "task-xyz", "title": "Update homepage", ...}}]}}
**Step 3 - Update task**: {{"name": "update_task", "arguments": {{"id": "task-xyz", "status": "IN_PROGRESS"}}}}
**Response**: "The 'Update homepage' task is now marked as in progress."

## Example 4: Query Specific Project Details
**User**: "What tasks do I have in the Website project?"
**Step 1 - Find project**: {{"name": "query_projects", "arguments": {{"name": "Website", "userId": "{userId}"}}}}
**[Returns]: {{"projects": [{{"id": "proj-123", ...}}]}}
**Step 2 - List tasks**: {{"name": "list_tasks", "arguments": {{"projectId": "proj-123"}}}}
**Response**: "In your Website project, you have: [list tasks from result]"

## Example 5: Using Context-Aware IDs
**Context**: Previous message mentioned "project proj-abc123"
**User**: "Add a task to review the design"
**[Check context for proj-abc123]**
**Action**: {{"name": "create_task", "arguments": {{"title": "Review the design", "projectId": "proj-abc123", "createdBy": "{userId}", "status": "TODO"}}}}
**Response**: "I've added 'Review the design' to your project."

## Example 6: Create Risk
**User**: "Add a risk about potential delays to the Website project"
**Step 1**: {{"name": "query_projects", "arguments": {{"name": "Website", "userId": "{userId}"}}}}
**[Returns projectId]**
**Step 2**: {{"name": "create_risk", "arguments": {{"projectId": "proj-xyz", "title": "Potential delays", "description": "Risk of timeline slippage", "likelihood": "MEDIUM", "impact": "HIGH", "createdBy": "{userId}"}}}}

# PARAMETER CONSISTENCY CHECKLIST
Before calling any project management tool, verify:
- ✓ userId/createdBy = '{userId}'
- ✓ projectId = Actual UUID from list/query (never invented)
- ✓ taskId/riskId = Actual UUID from list (never invented)
- ✓ status/priority = Valid enum value from tool schema
- ✓ All REQUIRED parameters present
- ✓ Parameter names match EXACTLY (not camelCase variations)

# RESPONSE RULES
- After tool execution completes, provide a clear natural language response.
- If a tool fails, explain what went wrong and suggest next steps.
- If you're uncertain about parameters, call 'list_tools' to verify.
- Include relevant details from tool results in your response (project names, task counts, IDs when helpful).
`,
      ],
    ]);
  }

  private async createTools(
    userId: string,
    conversationId: string
  ): Promise<any[]> {
    const mcpTools = await this.toolsService.listTools();

    // Create MCP tools with smart parameter enrichment
    const tools = mcpTools.map((tool) => {
      const schema = this.convertToZodSchema(tool.inputSchema);
      return new DynamicStructuredTool({
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        schema,
        func: async (input: any) => {
          // Smart parameter enrichment based on tool requirements
          const enrichedInput = { ...input };

          // Auto-inject userId if not provided and tool expects it
          if (!enrichedInput.userId && tool.inputSchema?.properties?.userId) {
            enrichedInput.userId = userId;
          }

          // Auto-inject createdBy if not provided and tool expects it
          if (
            !enrichedInput.createdBy &&
            tool.inputSchema?.properties?.createdBy
          ) {
            enrichedInput.createdBy = userId;
          }

          // Auto-inject owner if not provided and tool expects it
          if (!enrichedInput.owner && tool.inputSchema?.properties?.owner) {
            enrichedInput.owner = userId;
          }

          // Always include profileId for context (backwards compatibility)
          enrichedInput.profileId = userId;

          this.logger.debug(
            `Executing ${tool.name} with enriched parameters:`,
            Object.keys(enrichedInput)
          );

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
      }) as any;
    });

    // Add list_tools as a LangChain tool so LLM can discover available tools
    const listToolsTool = new DynamicStructuredTool({
      name: 'list_tools',
      description:
        'List all available tools with their descriptions and parameters. Call this when you need to discover what actions you can perform.',
      schema: z.object({}), // No parameters needed
      func: async () => {
        this.logger.log('LLM called list_tools to discover available actions');

        // Group tools by category for better organization
        const projectTools: any[] = [];
        const taskTools: any[] = [];
        const riskTools: any[] = [];
        const changeTools: any[] = [];
        const otherTools: any[] = [];

        mcpTools.forEach((tool) => {
          if (tool.name.includes('project')) projectTools.push(tool);
          else if (tool.name.includes('task')) taskTools.push(tool);
          else if (tool.name.includes('risk')) riskTools.push(tool);
          else if (tool.name.includes('change')) changeTools.push(tool);
          else otherTools.push(tool);
        });

        const formatToolCategory = (tools: any[], category: string) => {
          if (tools.length === 0) return '';
          const formatted = tools
            .map((tool) => {
              const params = tool.inputSchema?.properties || {};
              const required = tool.inputSchema?.required || [];

              const paramList = Object.entries(params)
                .map(([name, schema]: [string, any]) => {
                  const isRequired = required.includes(name);
                  const typeInfo = schema.type || 'any';
                  const description = schema.description || '';
                  const enumValues = schema.enum
                    ? ` (values: ${schema.enum.join(', ')})`
                    : '';
                  return `  - ${name} (${typeInfo})${enumValues}${
                    isRequired ? ' **[REQUIRED]**' : ' [optional]'
                  }: ${description}`;
                })
                .join('\n');

              return `### ${tool.name}
${tool.description || 'No description'}
**Parameters:**
${paramList || '  (none)'}`;
            })
            .join('\n\n');
          return `## ${category}\n\n${formatted}`;
        };

        const sections = [
          formatToolCategory(projectTools, 'PROJECT MANAGEMENT'),
          formatToolCategory(taskTools, 'TASK MANAGEMENT'),
          formatToolCategory(riskTools, 'RISK MANAGEMENT'),
          formatToolCategory(changeTools, 'CHANGE MANAGEMENT'),
          formatToolCategory(otherTools, 'OTHER TOOLS'),
        ].filter(Boolean);

        return `# AVAILABLE TOOLS

${sections.join('\n\n')}

## CRITICAL REMINDERS
- **userId/createdBy**: Auto-injected as current user (${userId}) if not provided
- **projectId/taskId/riskId**: MUST be obtained from list/query calls - NEVER fabricate
- **status/priority**: Use EXACT enum values shown above
- **Parameter names**: Use EXACTLY as shown - no variations allowed

Always verify parameter names match tool schemas before calling!`;
      },
    }) as any;

    // Return all tools including list_tools
    return [listToolsTool, ...tools] as any[];
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

    const promptTemplate = this.createSystemPromptTemplate();
    const systemMessages = await promptTemplate.formatMessages({
      personaName: persona.name,
      personaDescription: persona.description,
      userId: profile.id,
      userName: profile.profileName,
      conversationSummary: conversationSummary,
      projectContext: projectContext || '',
    });

    const tools = await this.createTools(profile.id, conversationId);
    const chatHistory = this.convertChatHistory(conversationHistory);

    const messages: BaseMessage[] = [
      ...systemMessages,
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    // Bind tools to LLM so it knows what tools are available and their schemas
    const llmWithTools = this.llm.bindTools(tools);
    this.logger.log(
      `Executing conversation with ${tools.length} tools bound to LLM`
    );

    const response = await llmWithTools.invoke(messages);

    // Check if response contains tool calls
    const toolCallsToExecute: any[] = (response as any).tool_calls || [];
    const toolCalls: Array<{ tool: string; input: unknown; output: unknown }> =
      [];

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
              arguments:
                typeof toolCall.args === 'string'
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
        const toolResultMessages = toolCalls.map(
          (tc) =>
            new AIMessage(
              `Tool ${tc.tool} result: ${JSON.stringify(tc.output)}`
            )
        );

        const finalMessages = [...messages, response, ...toolResultMessages];
        const finalResponse = await llmWithTools.invoke(finalMessages);

        return {
          response: finalResponse.content as string,
          intermediateSteps: [],
          toolCalls,
        };
      }
    }

    // No tool calls, just return the response
    return {
      response: response.content as string,
      intermediateSteps: [],
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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

    const promptTemplate = this.createSystemPromptTemplate();
    const systemMessages = await promptTemplate.formatMessages({
      personaName: persona.name,
      personaDescription: persona.description,
      userId: profile.id,
      userName: profile.profileName,
      conversationSummary: conversationSummary,
      projectContext: projectContext || '',
    });

    const tools = await this.createTools(profile.id, conversationId);
    const chatHistory = this.convertChatHistory(conversationHistory);

    const messages: BaseMessage[] = [
      ...systemMessages,
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    // Bind tools to LLM so it knows what tools are available and their schemas
    const llmWithTools = this.llm.bindTools(tools);
    this.logger.log(
      `Streaming conversation with ${tools.length} tools bound to LLM`
    );

    const stream = await llmWithTools.stream(messages);
    let fullResponse = '';

    // Stream chunks in real-time instead of accumulating
    for await (const chunk of stream) {
      if (chunk.content) {
        const contentStr =
          typeof chunk.content === 'string'
            ? chunk.content
            : JSON.stringify(chunk.content);
        fullResponse += contentStr;

        // Yield each chunk immediately for real-time updates
        yield { type: 'chunk', content: contentStr };
      }
    }

    // Final yield with complete response
    yield { type: 'final_response', content: fullResponse };
  }
}
