import { Injectable, Inject, Logger } from '@nestjs/common';
import { McpTool } from '@nestjs-mcp/server';
import { ClientProxy } from '@nestjs/microservices';
import { PersonaTelosCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

/**
 * MCP Tools for AI Persona Management and Referrals
 * These tools allow AI assistants to discover other AI personas and refer users/conversations
 * based on the TELOS-docs service
 */
@Injectable()
export class PersonaMcpService {
  private readonly logger = new Logger(PersonaMcpService.name);

  constructor(
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsService: ClientProxy
  ) {}

  @McpTool({
    name: 'list_ai_personas',
    description: 'List all available AI personas/assistants from the TELOS-docs service',
    parameters: {
      type: 'object',
      properties: {
        specialty: {
          type: 'string',
          description: 'Optional specialty filter to find personas with specific expertise (e.g., "project management", "development", "design")',
        },
      },
    },
  })
  async listAiPersonas({ specialty }: { specialty?: string }) {
    try {
      this.logger.log(`MCP Tool: Listing AI personas${specialty ? ` with specialty: ${specialty}` : ''}`);
      const personas = await firstValueFrom(
        this.telosDocsService.send(
          { cmd: PersonaTelosCommands.FIND },
          specialty ? { specialty } : {}
        )
      );
      
      return {
        success: true,
        personas: personas.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          skills: p.skills,
          expertise: p.expertise,
          specialty: p.specialty,
        })),
        count: personas.length,
      };
    } catch (error) {
      this.logger.error('Error listing AI personas:', error);
      throw new Error(`Failed to list AI personas: ${error.message}`);
    }
  }

  @McpTool({
    name: 'get_ai_persona',
    description: 'Get detailed information about a specific AI persona by ID or name',
    parameters: {
      type: 'object',
      properties: {
        personaId: {
          type: 'string',
          description: 'The ID of the persona to retrieve',
        },
        personaName: {
          type: 'string',
          description: 'The name of the persona to retrieve',
        },
      },
    },
  })
  async getAiPersona({ 
    personaId, 
    personaName 
  }: { 
    personaId?: string; 
    personaName?: string;
  }) {
    try {
      if (!personaId && !personaName) {
        throw new Error('Either personaId or personaName must be provided');
      }

      this.logger.log(`MCP Tool: Getting AI persona ${personaId || personaName}`);
      const query: any = {};
      if (personaId) query.id = personaId;
      if (personaName) query.name = personaName;

      const personas = await firstValueFrom(
        this.telosDocsService.send(
          { cmd: PersonaTelosCommands.FIND },
          query
        )
      );

      if (!personas || personas.length === 0) {
        throw new Error('Persona not found');
      }

      const persona = personas[0];
      return {
        success: true,
        persona: {
          id: persona.id,
          name: persona.name,
          description: persona.description,
          skills: persona.skills,
          expertise: persona.expertise,
          specialty: persona.specialty,
          goals: persona.goals,
          strengths: persona.strengths,
          limitations: persona.limitations,
        },
      };
    } catch (error) {
      this.logger.error('Error getting AI persona:', error);
      throw new Error(`Failed to get AI persona: ${error.message}`);
    }
  }

  @McpTool({
    name: 'find_specialist_persona',
    description: 'Find the most appropriate AI specialist persona for a given task or requirement. Use this when you need to refer a user to another AI assistant with specific expertise.',
    parameters: {
      type: 'object',
      properties: {
        requirement: {
          type: 'string',
          description: 'Description of the requirement or task that needs a specialist (e.g., "need help with React development", "project risk assessment", "UI/UX design advice")',
        },
        skillsNeeded: {
          type: 'array',
          description: 'Array of skills needed for the task',
          items: {
            type: 'string',
          },
        },
      },
      required: ['requirement'],
    },
  })
  async findSpecialistPersona({
    requirement,
    skillsNeeded = [],
  }: {
    requirement: string;
    skillsNeeded?: string[];
  }) {
    try {
      this.logger.log(`MCP Tool: Finding specialist persona for: ${requirement}`);
      
      // Get all personas
      const allPersonas = await firstValueFrom(
        this.telosDocsService.send(
          { cmd: PersonaTelosCommands.FIND },
          {}
        )
      );

      // Simple matching algorithm - in a real implementation, this could use embeddings or more sophisticated matching
      const scoredPersonas = allPersonas.map((persona: any) => {
        let score = 0;
        const requirementLower = requirement.toLowerCase();
        
        // Check if persona's specialty matches
        if (persona.specialty && requirementLower.includes(persona.specialty.toLowerCase())) {
          score += 10;
        }

        // Check if persona's description matches
        if (persona.description && requirementLower.includes(persona.description.toLowerCase())) {
          score += 5;
        }

        // Check skills
        if (persona.skills && Array.isArray(persona.skills)) {
          const matchingSkills = skillsNeeded.filter(skill => 
            persona.skills.some((pSkill: string) => 
              pSkill.toLowerCase().includes(skill.toLowerCase()) ||
              skill.toLowerCase().includes(pSkill.toLowerCase())
            )
          );
          score += matchingSkills.length * 3;
        }

        // Check expertise
        if (persona.expertise && Array.isArray(persona.expertise)) {
          skillsNeeded.forEach(skill => {
            if (persona.expertise.some((exp: string) => 
              exp.toLowerCase().includes(skill.toLowerCase())
            )) {
              score += 2;
            }
          });
        }

        return { persona, score };
      });

      // Sort by score and get top matches
      const topMatches = scoredPersonas
        .filter(sp => sp.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(sp => ({
          id: sp.persona.id,
          name: sp.persona.name,
          description: sp.persona.description,
          specialty: sp.persona.specialty,
          skills: sp.persona.skills,
          matchScore: sp.score,
        }));

      return {
        success: true,
        requirement,
        recommendedPersonas: topMatches,
        message: topMatches.length > 0 
          ? `Found ${topMatches.length} specialist(s) who can help with this requirement`
          : 'No specialists found matching this requirement',
      };
    } catch (error) {
      this.logger.error('Error finding specialist persona:', error);
      throw new Error(`Failed to find specialist persona: ${error.message}`);
    }
  }

  @McpTool({
    name: 'refer_to_persona',
    description: 'Create a referral message to introduce another AI persona to the user. This generates a helpful message you can send to explain why you are referring them to another specialist.',
    parameters: {
      type: 'object',
      properties: {
        personaId: {
          type: 'string',
          description: 'The ID of the persona to refer to',
        },
        reason: {
          type: 'string',
          description: 'The reason for the referral',
        },
        userQuery: {
          type: 'string',
          description: 'The original user query or request that prompted the referral',
        },
      },
      required: ['personaId', 'reason'],
    },
  })
  async referToPersona({
    personaId,
    reason,
    userQuery,
  }: {
    personaId: string;
    reason: string;
    userQuery?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Creating referral to persona ${personaId}`);
      
      // Get persona details
      const personas = await firstValueFrom(
        this.telosDocsService.send(
          { cmd: PersonaTelosCommands.FIND },
          { id: personaId }
        )
      );

      if (!personas || personas.length === 0) {
        throw new Error('Persona not found');
      }

      const persona = personas[0];

      // Generate a friendly referral message
      const referralMessage = `I think you would benefit from speaking with **${persona.name}**, who specializes in ${persona.specialty || 'this area'}.\n\n` +
        `**Why I'm referring you:**\n${reason}\n\n` +
        `**About ${persona.name}:**\n${persona.description}\n\n` +
        (persona.skills && persona.skills.length > 0 
          ? `**Expertise:** ${persona.skills.join(', ')}\n\n`
          : '') +
        (userQuery 
          ? `I'll make sure ${persona.name} has context about your request: "${userQuery}"\n\n`
          : '') +
        `Would you like me to connect you with ${persona.name}?`;

      return {
        success: true,
        referralMessage,
        persona: {
          id: persona.id,
          name: persona.name,
          specialty: persona.specialty,
        },
      };
    } catch (error) {
      this.logger.error('Error creating referral:', error);
      throw new Error(`Failed to create referral: ${error.message}`);
    }
  }
}
