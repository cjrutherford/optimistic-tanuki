import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import {
  ServiceTokens,
  GenerationCommands,
  MixCommands,
  AudioProjectCommands,
} from '@optimistic-tanuki/constants';

const generateSchema = z.object({
  projectId: z.string().describe('The project ID to generate music for'),
  prompt: z
    .string()
    .describe('Natural language description of the music to generate'),
  collaborationMode: z
    .enum(['full-auto', 'cover', 'full-collab'])
    .optional()
    .describe(
      'Generation mode: full-auto (AI does everything), cover (AI arranges around user vocals), full-collab (AI augments user work)'
    ),
  bpm: z.number().optional().describe('Tempo in beats per minute'),
  genre: z.string().optional().describe('Musical genre'),
  mood: z.string().optional().describe('Musical mood or emotion'),
  key: z.string().optional().describe('Musical key (e.g., C, Am, F#)'),
});

const mixSchema = z.object({
  projectId: z.string().describe('The project ID'),
  trackId: z.string().describe('The track ID to mix'),
  volume: z.number().optional().describe('Volume in dB (-60 to 12)'),
  pan: z.number().optional().describe('Pan position (-1 to 1)'),
});

const getProjectSchema = z.object({
  projectId: z.string().describe('The project ID'),
});

@Injectable()
export class AudioMcpService {
  private readonly logger = new Logger(AudioMcpService.name);

  constructor(
    @Inject(ServiceTokens.AUDIO_WORKSTATION_SERVICE)
    private readonly audioWorkstationClient: ClientProxy
  ) {}

  @McpTool({
    name: 'audio_generate',
    description:
      'Generate music from a text prompt using the Composer agent. Supports full-auto, cover, and full-collab modes.',
    parameters: generateSchema,
  })
  async audioGenerate(params: z.infer<typeof generateSchema>) {
    this.logger.log(
      `MCP tool audio_generate called for project ${params.projectId}`
    );
    return firstValueFrom(
      this.audioWorkstationClient.send(
        { cmd: GenerationCommands.REQUEST },
        {
          userId: 'mcp-agent',
          data: {
            projectId: params.projectId,
            collaborationMode: params.collaborationMode || 'full-auto',
            prompt: params.prompt,
            parameters: {
              bpm: params.bpm,
              genre: params.genre,
              mood: params.mood,
              key: params.key,
            },
          },
        }
      )
    );
  }

  @McpTool({
    name: 'audio_mix',
    description:
      'Adjust mix parameters for a track. Send volume and pan changes.',
    parameters: mixSchema,
  })
  async audioMix(params: z.infer<typeof mixSchema>) {
    this.logger.log(`MCP tool audio_mix called for track ${params.trackId}`);
    return firstValueFrom(
      this.audioWorkstationClient.send(
        { cmd: MixCommands.SAVE },
        {
          userId: 'mcp-agent',
          data: {
            projectId: params.projectId,
            trackId: params.trackId,
            volume: params.volume ?? 0,
            pan: params.pan ?? 0,
            eq: {},
            dynamics: {},
            effects: {},
          },
        }
      )
    );
  }

  @McpTool({
    name: 'audio_get_project',
    description:
      'Get the current state of a project including all tracks and mix settings.',
    parameters: getProjectSchema,
  })
  async audioGetProject(params: z.infer<typeof getProjectSchema>) {
    this.logger.log(
      `MCP tool audio_get_project called for project ${params.projectId}`
    );
    return firstValueFrom(
      this.audioWorkstationClient.send(
        { cmd: AudioProjectCommands.GET },
        { id: params.projectId, userId: 'mcp-agent' }
      )
    );
  }
}
