/**
 * System Prompt Builder Service
 *
 * Centralizes all system prompt construction for AI orchestration.
 * Ensures TELOS-driven conversations with single source of truth.
 *
 * This service:
 * - Fetches complete TELOS context (persona, profile, project)
 * - Builds TELOS-first system prompts where persona identity is foundational
 * - Provides single injection point for all LLM conversations
 * - Caches TELOS data for performance
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  PersonaTelosDto,
  ProfileDto,
  ProfileTelosDto,
  ProjectTelosDto,
} from '@optimistic-tanuki/models';
import {
  PersonaTelosCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

export interface TelosContext {
  persona: PersonaTelosDto;
  profile: ProfileDto;
  profileTelos?: ProfileTelosDto;
  projectTelos?: ProjectTelosDto;
  conversationSummary?: string;
  projectContext?: string;
}

export interface SystemPromptOptions {
  includeTools?: boolean;
  includeExamples?: boolean;
  includeProjectContext?: boolean;
}

@Injectable()
export class SystemPromptBuilder {
  private readonly logger = new Logger(SystemPromptBuilder.name);
  
  // Simple cache to avoid re-fetching TELOS data within same session
  private telosCache = new Map<string, any>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsService: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService: ClientProxy
  ) {}

  /**
   * Build complete TELOS-driven system prompt
   */
  async buildSystemPrompt(
    context: {
      personaId: string;
      profileId: string;
      projectId?: string;
      conversationSummary?: string;
      projectContext?: string;
    },
    options: SystemPromptOptions = {}
  ): Promise<{ template: ChatPromptTemplate; variables: Record<string, any> }> {
    // Fetch all TELOS data
    const persona = await this.fetchPersonaTelos(context.personaId);
    const profile = await this.fetchProfile(context.profileId);
    
    // Profile TELOS and Project TELOS are optional enhanced context
    // For now, we work with what we have (PersonaTelosDto and ProfileDto)
    
    // Build TELOS-driven template
    const template = this.createTelosDrivenTemplate(options);
    
    // Build variables
    const variables = this.buildTemplateVariables({
      persona,
      profile,
      conversationSummary: context.conversationSummary,
      projectContext: context.projectContext,
    });

    return { template, variables };
  }

  /**
   * Create TELOS-first system prompt template
   * 
   * The persona's TELOS is presented as IDENTITY, not just capabilities
   */
  private createTelosDrivenTemplate(
    options: SystemPromptOptions
  ): ChatPromptTemplate {
    const sections: string[] = [];

    // 1. PERSONA IDENTITY (TELOS Framework) - This comes FIRST
    sections.push(`# PERSONA IDENTITY (TELOS Framework)

You are {personaName}, an AI assistant embodying the following TELOS (purpose and nature):

## Core Objective (Your Purpose)
{personaCoreObjective}

## Goals (What You Strive to Achieve)
{personaGoals}

## Skills (How You Accomplish Your Goals)
{personaSkills}

## Limitations (Your Boundaries)
{personaLimitations}

## Description
{personaDescription}

## How You Engage with Users
Your responses should authentically reflect your goals, skillfully leverage your capabilities,
honestly respect your limitations, and consistently align with your core objective. Every 
interaction is an opportunity to fulfill your TELOS and serve the user effectively.

You are NOT role-playing as the user. You are an AI assistant with the above identity,
helping the user achieve THEIR goals.`);

    // 2. USER CONTEXT
    sections.push(`# USER CONTEXT (The Person You're Helping)

User Profile:
- Name: {userName}
- ID: {userId}

You are here to assist {userName} with their requests. Always respond from YOUR perspective
as the assistant (use "I" for your actions, "you" for the user's actions).`);

    // 3. CONVERSATION CONTEXT
    sections.push(`# CONVERSATION CONTEXT

{conversationSummary}`);

    // 4. PROJECT CONTEXT (if applicable)
    if (options.includeProjectContext !== false) {
      sections.push(`{projectContext}`);
    }

    // 5. TOOLS & CAPABILITIES (if applicable)
    if (options.includeTools !== false) {
      sections.push(`# TOOLS & CAPABILITIES

You have access to tools through the MCP (Model Context Protocol) system.

## Tool Discovery
To discover available tools, call the 'list_tools' tool. This shows all tools with exact 
parameter names and descriptions.

**IMPORTANT**: Available tools may change. Always use 'list_tools' when uncertain about:
- What tools are available
- What parameters a tool requires
- The exact parameter names to use

## ID Resolution (CRITICAL)
NEVER fabricate or guess IDs. ALWAYS follow this pattern:

1. **Need projectId?**
   - Call list_projects with userId: '{userId}'
   - Extract the 'id' field from returned project
   - Use that exact ID in subsequent calls

2. **Need taskId/riskId/changeId?**
   - Call list_tasks/list_risks/list_changes with projectId
   - Extract the 'id' field from returned items
   - Use that exact ID in subsequent calls

## Tool Calling Guidelines
1. **NO ID HALLUCINATION**: Never invent IDs. Query first.
2. **ONE TOOL AT A TIME**: Execute, observe, then decide next step
3. **EXACT PARAMETER NAMES**: Use parameter names exactly as specified
4. **USER ID BINDING**: Always use '{userId}' for userId/createdBy/owner fields`);
    }

    // 6. RESPONSE GUIDELINES
    sections.push(`# RESPONSE GUIDELINES

## Persona Alignment
- Stay true to your TELOS in every response
- Your goals guide WHAT you help with
- Your skills determine HOW you help
- Your limitations define WHAT you cannot do
- Your core objective is your north star

## Communication Style
- Use "I" when referring to YOUR actions (e.g., "I'll check...", "I've created...")
- Use "you" or "your" when referring to the USER (e.g., "your project", "you requested")
- Be clear, helpful, and aligned with your persona identity

## Tool Execution
- If user request requires data/action, call appropriate tool immediately
- After tool execution, provide clear natural language summary
- If tool fails, explain what went wrong and suggest alternatives
- Include relevant details from tool results in your response`);

    // 7. EXAMPLES (if requested)
    if (options.includeExamples) {
      sections.push(`# EXAMPLE INTERACTIONS

These examples show how you embody your TELOS while helping users:

## Example 1: Simple Request
**User**: "Create a new project called 'Website Redesign'"
**Your Response** (aligned with your goals and skills):
- Call create_project tool with proper parameters
- Respond: "I've created the 'Website Redesign' project for you. [Additional helpful context based on your persona goals]"

## Example 2: Complex Request
**User**: "Show me my high-priority tasks and explain which I should focus on first"
**Your Response** (leveraging your TELOS):
- Call list_tasks to get task list
- Analyze based on your persona's core objective
- Provide prioritized recommendations that reflect your goals and skills

## Example 3: Beyond Your Limitations
**User**: "Can you directly modify the database?"
**Your Response** (respecting your limitations):
- "I understand you need database changes, but that's beyond my limitations. However, I can help you [alternative approach that aligns with your capabilities]"`);
    }

    return ChatPromptTemplate.fromMessages([
      ['system', sections.join('\n\n')],
    ]);
  }

  /**
   * Build template variables from TELOS context
   */
  private buildTemplateVariables(context: {
    persona: PersonaTelosDto;
    profile: ProfileDto;
    conversationSummary?: string;
    projectContext?: string;
  }): Record<string, any> {
    return {
      // Persona TELOS
      personaName: context.persona.name,
      personaDescription: context.persona.description,
      personaGoals: this.formatList(context.persona.goals) || 'Assist users effectively',
      personaSkills: this.formatList(context.persona.skills) || 'General assistance capabilities',
      personaLimitations: this.formatList(context.persona.limitations) || 'Standard AI assistant limitations',
      personaCoreObjective: context.persona.coreObjective || 'Provide helpful, accurate assistance',
      
      // User context
      userId: context.profile.id,
      userName: context.profile.profileName || 'User',
      
      // Conversation context
      conversationSummary: context.conversationSummary || 'Beginning of conversation',
      
      // Project context (optional)
      projectContext: context.projectContext || '',
    };
  }

  /**
   * Format array into readable list
   */
  private formatList(items?: string[]): string {
    if (!items || items.length === 0) {
      return '';
    }
    if (items.length === 1) {
      return items[0];
    }
    if (items.length === 2) {
      return items.join(' and ');
    }
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }

  /**
   * Fetch persona TELOS with caching
   */
  private async fetchPersonaTelos(personaId: string): Promise<PersonaTelosDto> {
    const cacheKey = `persona:${personaId}`;
    const cached = this.getCached<PersonaTelosDto>(cacheKey);
    
    if (cached) {
      this.logger.debug(`Using cached persona TELOS for ${personaId}`);
      return cached;
    }

    try {
      const result = await firstValueFrom(
        this.telosDocsService.send(
          { cmd: PersonaTelosCommands.FIND },
          { id: personaId }
        )
      );

      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error(`Persona ${personaId} not found`);
      }

      const persona = result[0] as PersonaTelosDto;
      this.setCached(cacheKey, persona);
      
      return persona;
    } catch (error) {
      this.logger.error(`Failed to fetch persona TELOS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch profile with caching
   */
  private async fetchProfile(profileId: string): Promise<ProfileDto> {
    const cacheKey = `profile:${profileId}`;
    const cached = this.getCached<ProfileDto>(cacheKey);
    
    if (cached) {
      this.logger.debug(`Using cached profile for ${profileId}`);
      return cached;
    }

    try {
      const profile = await firstValueFrom(
        this.profileService.send(
          { cmd: ProfileCommands.Get },
          { id: profileId }
        )
      );

      if (!profile) {
        throw new Error(`Profile ${profileId} not found`);
      }

      this.setCached(cacheKey, profile);
      
      return profile;
    } catch (error) {
      this.logger.error(`Failed to fetch profile: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cached value if not expired
   */
  private getCached<T>(key: string): T | null {
    const cached = this.telosCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.telosCache.delete(key);
      return null;
    }
    
    return cached.value as T;
  }

  /**
   * Set cached value with timestamp
   */
  private setCached(key: string, value: any): void {
    this.telosCache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached TELOS data
   */
  clearCache(): void {
    this.telosCache.clear();
    this.logger.log('TELOS cache cleared');
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(key: string): void {
    this.telosCache.delete(key);
  }
}
