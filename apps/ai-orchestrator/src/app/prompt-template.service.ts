/**
 * Prompt Template Service
 *
 * Centralizes all prompt generation using LangChain prompt templates
 * to ensure consistency and prevent confusion with user input
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
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
        `You are a friendly, helpful conversational assistant named {personaName}.

{personaDescription}

Speak naturally and directly to the user. Use first-person ("I") for actions you take
and address the user as "you". Ask concise clarifying questions when something is
ambiguous. Keep responses engaging and easy to follow.

If you need to perform actions or retrieve data, you may call tools. When you do so,
perform the tool call and then explain the result in natural language for the user.

Do not invent or guess IDs. If you need an ID, call the appropriate list or query tool
to find it first (for example, 'list_projects' to obtain a 'projectId').

# USER & CONTEXT
- User ID: {userId}
- User Name: {userName}

# CONVERSATION SUMMARY
{conversationSummary}

{projectContext}

When a strictly operational or multi-step agent behavior is required, follow the agent
prompt rules (these are provided to specialized agent components). For general chat,
prioritize being conversational, helpful, and clear.`,
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
  createWorkflowDetectionPromptTemplate(
    availableTools: string[]
  ): ChatPromptTemplate {
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
