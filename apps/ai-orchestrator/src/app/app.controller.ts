import { Controller, Get, Logger, Optional } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import {
  AIOrchestrationCommands,
  CommonCommands,
  COPILOT_QUERY_DOCUMENTS,
} from '@optimistic-tanuki/constants';
import { CopilotQueryDto, CopilotResponseDto } from '@optimistic-tanuki/models';
import {
  ChatConversation,
  ChatMessage,
} from '@optimistic-tanuki/chat-contracts';
import { PersonaTelosDto } from '@optimistic-tanuki/telos-contracts';
import { getOrchestratorDependencyStates } from './app.module';
import { VaultCopilotService } from './vault-copilot.service';

@Controller()
export class AppController {
  constructor(
    private readonly l: Logger,
    private readonly appService: AppService,
    @Optional() private readonly vaultCopilotService?: VaultCopilotService
  ) {}

  @MessagePattern({ cmd: CommonCommands.HealthCheck })
  healthCheck() {
    const dependencies = getOrchestratorDependencyStates();
    const degraded = Object.values(dependencies).some(
      (state) => state === 'disabled'
    );
    return {
      status: degraded ? 'degraded' : 'healthy',
      dependencies,
    };
  }

  @MessagePattern({ cmd: AIOrchestrationCommands.PROFILE_INITIALIZE })
  async profileInitialize(data: {
    profileId: string;
    appId: string;
    personaId: string;
  }) {
    this.l.log(
      "profile initialized called. here's where we create the welcome chat...."
    );
    await this.appService.processNewProfile(
      data.profileId,
      data.appId,
      data.personaId
    );
    return data;
  }

  @MessagePattern({ cmd: AIOrchestrationCommands.CONVERSATION_UPDATE })
  async conversationUpdate(data: {
    conversation: ChatConversation;
    aiPersonas: PersonaTelosDto[];
  }) {
    this.l.log(
      "conversation updated called. here's where we update the chats and prompt the AI again...."
    );
    if (!data.conversation.id) {
      throw new RpcException('Conversation ID is required');
    }
    const update: Partial<ChatMessage>[] =
      await this.appService.updateConversation(data);
    return update;
  }

  @MessagePattern({ cmd: AIOrchestrationCommands.TELOS_UPDATE })
  async telosUpdate(data: any) {
    this.l.log(
      "telos updated called. here's where we update the telos documents...."
    );
  }

  @MessagePattern({ cmd: AIOrchestrationCommands.REFER_PERSONA })
  async referPersona(data: any) {
    this.l.log("refer persona called. here's where we refer the persona....");
  }

  /**
   * `accessToken` is the caller's own bearer token, forwarded by the gateway so
   * the copilot can open an MCP session as that caller. It is deliberately not
   * part of `CopilotQueryDto`: a DTO is validated from the request body, and a
   * credential that arrives in a body is a credential a client chose. The
   * gateway overwrites whatever the body carried, and the tenant that decides
   * what is readable comes from the session this token opens, not from `dto`.
   */
  @MessagePattern(COPILOT_QUERY_DOCUMENTS)
  async copilotQueryDocuments(
    data: CopilotQueryDto & { accessToken?: string }
  ): Promise<CopilotResponseDto> {
    if (!this.vaultCopilotService) {
      throw new Error('VaultCopilotService is not available');
    }
    const payload = (data ?? {}) as CopilotQueryDto & { accessToken?: string };
    const { accessToken, ...dto } = payload;
    return await this.vaultCopilotService.queryDocuments(dto, accessToken);
  }
}
