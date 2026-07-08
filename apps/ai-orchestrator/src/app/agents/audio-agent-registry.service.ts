import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AudioAgent } from './audio-agent.interface';
import { ComposerAgent } from './composer.agent';
import { StemAgent } from './stem.agent';
import { MixAgent } from './mix.agent';
import { MasterAgent } from './master.agent';

@Injectable()
export class AudioAgentRegistry implements OnModuleInit {
  private readonly logger = new Logger(AudioAgentRegistry.name);
  private readonly agents = new Map<string, AudioAgent>();

  constructor(
    private readonly composer: ComposerAgent,
    private readonly stem: StemAgent,
    private readonly mix: MixAgent,
    private readonly master: MasterAgent
  ) {}

  onModuleInit() {
    this.register(this.composer);
    this.register(this.stem);
    this.register(this.mix);
    this.register(this.master);
    this.logger.log(`Registered ${this.agents.size} audio agents`);
  }

  private register(agent: AudioAgent) {
    this.agents.set(agent.name, agent);
  }

  getAgent(name: string): AudioAgent {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Unknown audio agent: ${name}`);
    }
    return agent;
  }

  getRegisteredAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}
