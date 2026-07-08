import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { AudioAgentRegistry } from './agents/audio-agent-registry.service';
import { AudioAgentInput } from './agents/audio-agent.interface';

@Controller()
export class AudioController {
  private readonly logger = new Logger(AudioController.name);

  constructor(private readonly agentRegistry: AudioAgentRegistry) {}

  @MessagePattern({ cmd: 'EXECUTE_COMPOSE_AGENT' })
  async executeComposer(@Payload() data: AudioAgentInput) {
    this.logger.log(
      `Received EXECUTE_COMPOSE_AGENT for request ${data.requestId}`
    );
    try {
      return await this.agentRegistry.getAgent('compose').execute(data);
    } catch (err) {
      this.logger.error(`Compose agent execution failed: ${err.message}`);
      throw new RpcException(err.message);
    }
  }

  @MessagePattern({ cmd: 'EXECUTE_STEM_AGENT' })
  async executeStem(@Payload() data: AudioAgentInput) {
    this.logger.log(
      `Received EXECUTE_STEM_AGENT for request ${data.requestId}`
    );
    try {
      return await this.agentRegistry.getAgent('stem').execute(data);
    } catch (err) {
      this.logger.error(`Stem agent execution failed: ${err.message}`);
      throw new RpcException(err.message);
    }
  }

  @MessagePattern({ cmd: 'EXECUTE_MIX_AGENT' })
  async executeMix(@Payload() data: AudioAgentInput) {
    this.logger.log(`Received EXECUTE_MIX_AGENT for request ${data.requestId}`);
    try {
      return await this.agentRegistry.getAgent('mix').execute(data);
    } catch (err) {
      this.logger.error(`Mix agent execution failed: ${err.message}`);
      throw new RpcException(err.message);
    }
  }

  @MessagePattern({ cmd: 'EXECUTE_MASTER_AGENT' })
  async executeMaster(@Payload() data: AudioAgentInput) {
    this.logger.log(
      `Received EXECUTE_MASTER_AGENT for request ${data.requestId}`
    );
    try {
      return await this.agentRegistry.getAgent('master').execute(data);
    } catch (err) {
      this.logger.error(`Master agent execution failed: ${err.message}`);
      throw new RpcException(err.message);
    }
  }

  @MessagePattern({ cmd: 'LIST_AUDIO_AGENTS' })
  async listAgents() {
    return this.agentRegistry.getRegisteredAgents();
  }
}
