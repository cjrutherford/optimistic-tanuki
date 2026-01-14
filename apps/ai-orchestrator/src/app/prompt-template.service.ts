/**
 * Prompt Template Service
 *
 * Centralizes all prompt generation using LangChain prompt templates
 * to ensure consistency and prevent confusion with user input
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { PersonaTelosDto, ProfileDto } from '@optimistic-tanuki/models';

@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);

  /**
   * Create system prompt template with persona TELOS information
   */
  createSystemPromptTemplate(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an AI assistant named {personaName}.

{personaDescription}

# YOUR CAPABILITIES AND ROLE
Goals: {personaGoals}
Skills: {personaSkills}
Limitations: {personaLimitations}
Core Objective: {personaCoreObjective}

You are helping the user with their requests. The user is NOT you - you are the assistant.

# USER INFORMATION (the person you are helping)
- User ID: {userId}
- User Name: {userName}

# CONVERSATION SUMMARY
{conversationSummary}

{projectContext}

# TOOL DISCOVERY
You have access to tools through the MCP (Model Context Protocol) system. To discover what tools are available, call the 'list_tools' tool.

**IMPORTANT**: The available tools may change over time. Always use 'list_tools' when you're uncertain about:
- What tools are available
- What parameters a tool requires
- The exact parameter names to use

# DATA RELATIONSHIPS & CRITICAL PARAMETER MAPPINGS

## User Identity Parameters
- **userId** or **createdBy**: ALWAYS use '{userId}' (the current user's profile ID)
- **profileId**: SAME as userId - use '{userId}'
- **owner**: SAME as userId - use '{userId}'

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
2. **NO ID HALLUCINATION**: You must NEVER invent IDs. If you need an ID, you MUST first query or list the items to find the correct ID.
3. **TOOL FIRST APPROACH**: If a user request requires data or action, call the appropriate tool immediately.
4. **ONE TOOL AT A TIME**: Execute one tool call, wait for the result, then decide the next step.
5. **JSON ONLY OUTPUT**: When calling a tool, output ONLY the JSON object. No markdown, no explanations.
6. **USER ID BINDING**: Always use the provided User ID ({userId}) for 'userId', 'createdBy', 'owner', etc.
7. **EXACT PARAMETER NAMES**: Use the EXACT parameter names from the tool schema.

# RESPONSE RULES
- You are the AI assistant. The user is the person you're helping. Always respond from the assistant's perspective.
- Use "I" when referring to actions you take (e.g., "I've created...", "I'll check...")
- Use "you" or "your" when referring to the user (e.g., "your project", "you requested")
- After tool execution completes, provide a clear natural language response.
- If a tool fails, explain what went wrong and suggest next steps.
- Include relevant details from tool results in your response.
`,
      ],
    ]);
  }

  /**
   * Create agent prompt template for multi-step reasoning
   */
  createAgentPromptTemplate(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an AI assistant helping users manage projects, tasks, risks, and more.

IMPORTANT: You are the assistant. The user is the person making requests. Do not respond as if you are the user.

# CORE OPERATING PROCEDURE (THINK-ACT LOOP)
1. **THINK**: Analyze the user's request. What information is missing? Do you need an ID?
2. **ACT**: If you need data, call a 'list_*' or 'query_*' tool. If you have data, call a 'create_*' or 'update_*' tool.
3. **OBSERVE**: Wait for the tool result.
4. **REFINE**: If the tool failed, analyze the error. Did you use the wrong ID? Wrong parameters? Retry with corrected values.

# OPERATIONAL RULES
1. **NO HALLUCINATIONS**: NEVER invent IDs. If you need a 'projectId', 'taskId', or any other ID, you MUST find it using a list or query tool first.
2. **TOOL DISCOVERY**: Call 'list_tools' when uncertain about available actions or parameter names.
3. **SEQUENTIAL EXECUTION**: Call ONE tool at a time. Wait for the result.
4. **CONTEXT INJECTION**: Do NOT provide 'userId', 'profileId', or 'createdBy' unless you are assigning to a DIFFERENT user. The system automatically injects the current user's ID.

{conversationSummary}
`,
      ],
      new MessagesPlaceholder('messages'),
    ]);
  }

  /**
   * Create workflow detection prompt template
   */
  createWorkflowDetectionPromptTemplate(availableTools: string[]): ChatPromptTemplate {
    const toolsList =
      availableTools.length > 0
        ? `Available tools: ${availableTools.join(', ')}`
        : 'No tools currently available';

    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a workflow classifier. Your job is to analyze user prompts and determine the best workflow type.

${toolsList}

Classify the user's prompt into one of these workflows:
1. CONVERSATIONAL - Simple question/answer, greeting, or general conversation that doesn't require external data or actions
2. TOOL_CALLING - Request requires executing tools/actions (creating, updating, listing, querying data)
3. HYBRID - Request requires both tool execution AND a conversational explanation

Respond ONLY with a JSON object in this exact format:
{{
  "type": "conversational" | "tool_calling" | "hybrid",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "requiresToolCalling": boolean,
  "requiresConversation": boolean
}}`,
      ],
      ['human', '{userPrompt}'],
    ]);
  }

  /**
   * Format persona TELOS data for prompt
   */
  formatPersonaTelos(persona: PersonaTelosDto): {
    personaName: string;
    personaDescription: string;
    personaGoals: string;
    personaSkills: string;
    personaLimitations: string;
    personaCoreObjective: string;
  } {
    return {
      personaName: persona.name,
      personaDescription: persona.description,
      personaGoals: persona.goals?.join(', ') || 'No specific goals defined',
      personaSkills: persona.skills?.join(', ') || 'No specific skills defined',
      personaLimitations:
        persona.limitations?.join(', ') || 'No specific limitations defined',
      personaCoreObjective:
        persona.coreObjective || 'Assist the user effectively',
    };
  }

  /**
   * Format user profile data for prompt
   */
  formatUserProfile(profile: ProfileDto): {
    userId: string;
    userName: string;
  } {
    return {
      userId: profile.id,
      userName: profile.profileName || 'User',
    };
  }
}
