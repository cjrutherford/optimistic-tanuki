import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  ChatCommands,
  PersonaTelosCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import {
  ChatConversation,
  ChatMessage,
  PersonaTelosDto,
  ProfileDto,
} from '@optimistic-tanuki/models';
import { LangChainService } from './langchain.service';
import { LangGraphService } from './langgraph.service';
import { LangChainAgentService } from './langchain-agent.service';
import { ContextStorageService } from './context-storage.service';
import { SystemPromptBuilder } from './system-prompt-builder.service';
import { ToolValidationService } from './tool-validation.service';
import { EnhancedMCPToolExecutor } from './enhanced-mcp-tool-executor.service';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { StreamingEventType } from './streaming-events';

const TOOL_OUTPUT_BLACKLIST = ['list_tools'];
const TOOL_RESULT_SUMMARIES: Record<string, string> = {
  list_tools: 'Available tools retrieved',
};

function getToolResultContent(tool: string, output: unknown): string {
  if (TOOL_OUTPUT_BLACKLIST.includes(tool)) {
    return TOOL_RESULT_SUMMARIES[tool] || 'Tool executed successfully';
  }
  return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
}

@Injectable()
export class AppService {
  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsService: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService: ClientProxy,
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatCollectorService: ClientProxy,
    @Inject('ai-enabled-apps')
    private readonly aiEnabledApps: { [key: string]: string },
    private readonly langChainService: LangChainService,
    private readonly langGraphService: LangGraphService,
    private readonly langChainAgentService: LangChainAgentService,
    private readonly contextStorage: ContextStorageService,
    private readonly systemPromptBuilder: SystemPromptBuilder,
    private readonly toolValidation: ToolValidationService,
    private readonly enhancedToolExecutor: EnhancedMCPToolExecutor
  ) {}

  /**
   * Convert chat messages to LangChain BaseMessage format
   */
  private convertToLangChainMessages(messages: ChatMessage[]): BaseMessage[] {
    return messages.map((msg) => {
      const role = msg.role || 'user';
      const senderName = msg.senderName || '';
      const content = msg.content || '';
      // AI personas are assistants
      if (
        role === 'assistant' ||
        senderName.toLowerCase().includes('assistant')
      ) {
        return new AIMessage(content);
      }
      // User messages
      return new HumanMessage(content);
    });
  }

  /**
   * Parse TELOS data from response
   */
  private parseTelosResponse(response: string): {
    content: string;
    telosData: any | null;
  } {
    const parts = response.split('---');
    if (parts.length === 1) {
      return { content: response, telosData: null };
    }

    const content = parts[0].trim();
    const telosSection = parts[1].trim();

    try {
      // Try to parse as JSON
      const jsonMatch = telosSection.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const telosData = JSON.parse(jsonMatch[0]);
        return { content, telosData };
      }
    } catch (e) {
      this.l.warn('Failed to parse TELOS data:', e);
    }

    return { content: response, telosData: null };
  }

  /**
   * Get persona data
   */
  private async getPersona(data: { id: string }): Promise<PersonaTelosDto> {
    try {
      const result = await firstValueFrom(
        this.telosDocsService.send({ cmd: PersonaTelosCommands.FIND }, data)
      );

      // Expecting an array response from the telos docs service
      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error('Persona not found');
      }

      return result[0] as PersonaTelosDto;
    } catch (error) {
      this.l.error('Error getting persona:', error);
      throw new RpcException('Failed to get persona: ' + error.message);
    }
  }

  // /**
  //  * Summarize conversation for context
  //  */
  // private async summarizeConversation(
  //   messages: ChatMessage[],
  //   persona: PersonaTelosDto
  // ): Promise<string> {
  //   if (messages.length === 0) {
  //     return 'No previous conversation history.';
  //   }

  //   // Simple summary for now - can be enhanced
  //   const recentCount = Math.min(messages.length, 5);
  //   const recentMessages = messages.slice(-recentCount);

  //   return `Recent conversation (last ${recentCount} messages): ${recentMessages
  //     .map((m) => `${m.senderName}: ${m.content}`)
  //     .join(' | ')}`;
  // }

  async processNewProfile(
    profileId: string,
    appId: string,
    personaId: string
  ): Promise<Partial<ChatMessage>[]> {
    try {
      const assistant: PersonaTelosDto = await this.getPersona({
        id: personaId || 'assistant',
      });
      const profile: ProfileDto = await firstValueFrom(
        this.profileService.send(
          { cmd: ProfileCommands.Get },
          { id: profileId }
        )
      );

      if (!profile) {
        throw new Error('Profile not found');
      }

      this.l.log(`Creating welcome chat for profile: '${profileId}'`);
      this.l.log(`Using assistant: '${assistant.name}'`);

      // Create welcome message
      const welcomePrompt = `Hello, I'm ${profile.profileName}, and I just created my profile. I need help getting started, and I'm new here. Please ask me questions to help me clarify my goals and projects.`;

      const conversationSummary = `The user has just created a profile as a user of ${appId}. This app's description is: ${
        this.aiEnabledApps[appId] ?? 'No description available'
      }. The user may have limited information in their profile. Your goal is to assist the user in fleshing out their projects and goals. Behind the scenes, provide JSON output with potential TELOS data points. Inform the user that they can export their TELOS data at any time. TELOS is not an acronym, but a framework for maintaining focus and clarity for both AI and humans. TELOS data should be included at the end of the response in json format separated from the main response with '---'. JSON format should be with keys for goals, skills, interests, limitations, strengths, objectives, coreObjective, and overallProfileSummary.
      Please do not use tools for this initial welcome message. Focus on engaging the user and gathering information.`;

      const responses: Partial<ChatMessage>[] = [];

      // Use LangGraph to execute with state management
      const langChainMessages: BaseMessage[] = [
        new HumanMessage(welcomePrompt),
      ];

      // No external prompt proxy call here — the conversation is seeded
      // directly via LangGraph/LangChain messages to avoid runtime
      // dependencies on the prompt proxy service.

      // Phase 1 fix: No longer pass conversationSummary to executeConversation
      const result = await this.langGraphService.executeConversation(
        profile.id,
        langChainMessages,
        [], // Empty chat history for new profile
        assistant,
        profile,
        '' // No conversation ID yet
      );

      // Parse response to extract TELOS data if present
      const { content, telosData } = this.parseTelosResponse(result.response);

      const newChatMessage: Partial<ChatMessage> = {
        conversationId: '',
        senderId: assistant.id,
        senderName: assistant.name,
        recipientId: [profile.id],
        recipientName: [profile.profileName],
        content: content,
        timestamp: new Date(),
        type: 'chat',
      };

      responses.push(newChatMessage);

      // Post message to chat collector (Forge of Will flow)
      this.l.log('Posting welcome message to chat collector');
      await firstValueFrom(
        this.chatCollectorService.send(
          { cmd: ChatCommands.POST_MESSAGE },
          newChatMessage
        )
      );

      return responses;
    } catch (error) {
      console.trace(error);
      this.l.error('Error processing new profile:', error);
      throw new RpcException('Failed to process new profile: ' + error.message);
    }
  }

  /**
   * Summarize conversation for context
   */
  private async summarizeConversation(
    messages: ChatMessage[]
  ): Promise<string> {
    // Lightweight internal summarizer so we don't depend on the external
    // prompt proxy. Keeps conversation summarization deterministic for
    // unit tests and avoids runtime RPC dependencies.
    if (!messages || messages.length === 0) {
      return 'No previous conversation history.';
    }

    const recentCount = Math.min(messages.length, 5);
    const recentMessages = messages.slice(-recentCount);

    return `Recent conversation (last ${recentCount} messages): ${recentMessages
      .map((m) => `${m.senderName}: ${m.content}`)
      .join(' | ')}`;
  }

  async updateConversation(data: {
    conversation: ChatConversation;
    aiPersonas: PersonaTelosDto[];
  }): Promise<Partial<ChatMessage>[]> {
    try {
      const { conversation, aiPersonas } = data;

      const lastMessage =
        conversation.messages[conversation.messages.length - 1];
      const profile: ProfileDto = await firstValueFrom(
        this.profileService.send(
          { cmd: ProfileCommands.Get },
          { id: lastMessage.senderId }
        )
      );

      const responses: Partial<ChatMessage>[] = [];

      for (const persona of aiPersonas) {
        this.l.log(`Processing conversation for persona: ${persona.name}`);

        // Initialize agent with user context
        await this.langChainAgentService.initializeAgent(
          profile.id,
          conversation.id
        );

        // Load existing context from Redis
        const existingContext = await this.contextStorage.getContext(
          profile.id
        );

        // Generate conversation summary without old prompt generation library
        const generatedSummary = await this.summarizeConversation(
          conversation.messages
        );

        const conversationSummary =
          existingContext?.summary || generatedSummary || '';

        this.l.log(`Loaded context for profile ${profile.id}:`, {
          hasSummary: !!conversationSummary,
          topicCount: existingContext?.recentTopics?.length || 0,
          activeProjects: existingContext?.activeProjects?.length || 0,
        });

        // Convert messages to LangChain format
        const langChainMessages = this.convertToLangChainMessages(
          conversation.messages.slice(0, -1) // Exclude last message (current user input)
        );

        // Add the current user message
        langChainMessages.push(new HumanMessage(lastMessage.content));

        try {
          // Emit workflow start event
          await firstValueFrom(
            this.chatCollectorService.send(
              { cmd: ChatCommands.POST_MESSAGE },
              {
                conversationId: conversation.id,
                senderId: persona.id,
                senderName: persona.name,
                recipientId: [profile.id],
                recipientName: [profile.profileName],
                content: '⚡ Starting AI processing...',
                timestamp: new Date(),
                type: 'system',
              }
            )
          );

          // Use LangGraph with Agent for state-managed, multi-step execution
          this.l.log('Executing conversation through LangGraph with Agent...');

          // Phase 1 fix: No longer pass conversationSummary to executeConversation
          const result = await this.langGraphService.executeConversation(
            profile.id,
            langChainMessages,
            conversation.messages, // Pass full chat history
            persona,
            profile,
            conversation.id,
            true, // Use agent for multi-step reasoning
            async (progress) => {
              this.l.debug('Received progress update:', progress);
              try {
                if (progress.type === StreamingEventType.THINKING) {
                  const thinkingMessage: Partial<ChatMessage> = {
                    conversationId: conversation.id,
                    senderId: persona.id,
                    senderName: persona.name,
                    recipientId: [profile.id],
                    recipientName: [profile.profileName],
                    content: `💭 ${progress.content.text}`,
                    timestamp: new Date(),
                    type: 'system',
                  };
                  await firstValueFrom(
                    this.chatCollectorService.send(
                      { cmd: ChatCommands.POST_MESSAGE },
                      thinkingMessage
                    )
                  );
                  responses.push(thinkingMessage);
                } else if (progress.type === StreamingEventType.TOOL_START) {
                  const toolCallMessage: Partial<ChatMessage> = {
                    conversationId: conversation.id,
                    senderId: persona.id,
                    senderName: persona.name,
                    recipientId: [profile.id],
                    recipientName: [profile.profileName],
                    content: `🔧 Using: ${progress.content.tool}`,
                    timestamp: new Date(),
                    type: 'system',
                  };
                  await firstValueFrom(
                    this.chatCollectorService.send(
                      { cmd: ChatCommands.POST_MESSAGE },
                      toolCallMessage
                    )
                  );
                  responses.push(toolCallMessage);
                } else if (progress.type === StreamingEventType.TOOL_END) {
                  const resultContent = getToolResultContent(
                    progress.content.tool,
                    progress.content.output
                  );
                  const toolResultMessage: Partial<ChatMessage> = {
                    conversationId: conversation.id,
                    senderId: persona.id,
                    senderName: persona.name,
                    recipientId: [profile.id],
                    recipientName: [profile.profileName],
                    content: `✓ ${resultContent}`,
                    timestamp: new Date(),
                    type: 'system',
                  };
                  await firstValueFrom(
                    this.chatCollectorService.send(
                      { cmd: ChatCommands.POST_MESSAGE },
                      toolResultMessage
                    )
                  );
                  responses.push(toolResultMessage);
                } else if (
                  progress.type === StreamingEventType.RESPONSE_START
                ) {
                  const responseStartMessage: Partial<ChatMessage> = {
                    conversationId: conversation.id,
                    senderId: persona.id,
                    senderName: persona.name,
                    recipientId: [profile.id],
                    recipientName: [profile.profileName],
                    content: '📝 Generating response...',
                    timestamp: new Date(),
                    type: 'system',
                  };
                  await firstValueFrom(
                    this.chatCollectorService.send(
                      { cmd: ChatCommands.POST_MESSAGE },
                      responseStartMessage
                    )
                  );
                  responses.push(responseStartMessage);
                }
              } catch (err) {
                this.l.error('Error sending progress update:', err);
              }
            }
          );

          this.l.log('LangGraph execution complete:', {
            hasResponse: !!result.response,
            toolCallsCount: result.toolCalls?.length || 0,
            topics: result.topics?.length || 0,
          });

          // Process intermediate steps (tool calls) - these are auto-emitted by LangGraph
          // We now handle this via the progress callback, so we don't need to re-emit them here
          // unless we want to ensure they are in the final response list if the callback failed?
          // But we pushed to responses in the callback.

          /* 
          if (result.toolCalls && result.toolCalls.length > 0) {
             // ... removed ...
          }
          */

          // Parse final response for TELOS data
          const { content, telosData } = this.parseTelosResponse(
            result.response
          );

          // Emit final response
          const finalMessage: Partial<ChatMessage> = {
            conversationId: conversation.id,
            senderId: persona.id,
            senderName: persona.name,
            recipientId: [profile.id],
            recipientName: [profile.profileName],
            content: content,
            timestamp: new Date(),
            type: 'chat',
          };

          await firstValueFrom(
            this.chatCollectorService.send(
              { cmd: ChatCommands.POST_MESSAGE },
              finalMessage
            )
          );
          responses.push(finalMessage);

          this.l.log('Conversation processing complete for', persona.name);

          // Context is automatically saved by LangGraph service to Redis
        } catch (executionError) {
          this.l.log('Error executing LangGraph conversation:', executionError);

          // Emit error message
          const errorMessage: Partial<ChatMessage> = {
            conversationId: conversation.id,
            senderId: persona.id,
            senderName: persona.name,
            recipientId: [profile.id],
            recipientName: [profile.profileName],
            content: `⚠️ Error processing conversation: ${executionError.message}`,
            timestamp: new Date(),
            type: 'system',
          };

          await firstValueFrom(
            this.chatCollectorService.send(
              { cmd: ChatCommands.POST_MESSAGE },
              errorMessage
            )
          );
          responses.push(errorMessage);
        }
      }

      return responses;
    } catch (error) {
      console.trace(error);
      this.l.log('Error updating conversation:', error);
      throw new RpcException('Failed to update conversation: ' + error.message);
    }
  }

  /**
   * Execute a tool call with intelligent error handling and retry logic
   */
  async executeToolWithIntelligence(
    toolName: string,
    parameters: Record<string, unknown>,
    conversationId: string,
    persona: PersonaTelosDto,
    profile: ProfileDto,
    retryCount: number = 0
  ): Promise<{
    success: boolean;
    result?: unknown;
    errorMessage?: string;
    shouldRetry?: boolean;
  }> {
    const MAX_RETRIES = 2;

    try {
      this.l.log(
        `Attempting to execute tool: ${toolName} (attempt ${retryCount + 1})`
      );

      // Validate parameters first
      const validation = this.toolValidation.validateToolCall(
        toolName,
        parameters
      );
      if (!validation.isValid) {
        const errorMsg = `Parameter validation failed: ${validation.errors.join(
          ', '
        )}`;
        this.l.warn(errorMsg);

        // Send validation error message with suggestions
        const suggestions =
          validation.suggestions?.join(' ') ||
          this.toolValidation.generateToolHelpMessage(toolName);
        await this.sendToolErrorMessage(
          conversationId,
          persona,
          profile,
          toolName,
          errorMsg,
          suggestions,
          false
        );

        return {
          success: false,
          errorMessage: errorMsg,
          shouldRetry: false, // Don't retry validation errors without parameter changes
        };
      }

      // Execute the tool with enhanced executor
      const result = await this.enhancedToolExecutor.executeToolWithGuidance(
        toolName,
        parameters,
        conversationId
      );

      if (result.result !== undefined) {
        // Success!
        this.l.log(`Tool ${toolName} executed successfully`);
        await this.sendToolSuccessMessage(
          conversationId,
          persona,
          profile,
          toolName,
          result.result
        );

        return {
          success: true,
          result: result.result,
        };
      } else {
        // Tool failed, analyze the error
        const shouldRetry =
          retryCount < MAX_RETRIES && this.isRetryableError(result.error || '');

        if (shouldRetry) {
          this.l.warn(
            `Tool ${toolName} failed, will retry. Error: ${result.error}`
          );
          await this.sendToolRetryMessage(
            conversationId,
            persona,
            profile,
            toolName,
            result.error,
            retryCount + 1
          );

          // Wait before retry
          await this.sleep(1000 * (retryCount + 1)); // Exponential backoff

          return await this.executeToolWithIntelligence(
            toolName,
            parameters,
            conversationId,
            persona,
            profile,
            retryCount + 1
          );
        } else {
          // Final failure - provide guidance
          await this.sendToolErrorMessage(
            conversationId,
            persona,
            profile,
            toolName,
            result.error || 'Unknown error',
            result.guidance || 'Please check your parameters and try again.',
            false
          );

          return {
            success: false,
            errorMessage: result.error,
            shouldRetry: false,
          };
        }
      }
    } catch (error) {
      this.l.error(`Unexpected error in tool execution: ${error.message}`);

      const shouldRetry = retryCount < MAX_RETRIES;
      if (shouldRetry) {
        this.l.warn(`Unexpected error, retrying tool ${toolName}`);
        return await this.executeToolWithIntelligence(
          toolName,
          parameters,
          conversationId,
          persona,
          profile,
          retryCount + 1
        );
      } else {
        await this.sendToolErrorMessage(
          conversationId,
          persona,
          profile,
          toolName,
          error.message,
          'An unexpected error occurred. Please try again later.',
          false
        );

        return {
          success: false,
          errorMessage: error.message,
          shouldRetry: false,
        };
      }
    }
  }

  /**
   * Send tool success message to chat
   */
  private async sendToolSuccessMessage(
    conversationId: string,
    persona: PersonaTelosDto,
    profile: ProfileDto,
    toolName: string,
    result: any
  ) {
    const message: Partial<ChatMessage> = {
      conversationId,
      senderId: persona.id,
      senderName: persona.name,
      recipientId: [profile.id],
      recipientName: [profile.profileName],
      content: `✅ Successfully executed ${toolName}`,
      timestamp: new Date(),
      type: 'system',
    };

    await firstValueFrom(
      this.chatCollectorService.send(
        { cmd: ChatCommands.POST_MESSAGE },
        message
      )
    );
  }

  /**
   * Send tool error message with guidance
   */
  private async sendToolErrorMessage(
    conversationId: string,
    persona: PersonaTelosDto,
    profile: ProfileDto,
    toolName: string,
    error: string,
    guidance: string,
    isRetrying: boolean
  ) {
    const message: Partial<ChatMessage> = {
      conversationId,
      senderId: persona.id,
      senderName: persona.name,
      recipientId: [profile.id],
      recipientName: [profile.profileName],
      content: `❌ Tool ${toolName} failed: ${error}\n\n${guidance}${
        isRetrying ? "\n\nI'll try to fix this and retry." : ''
      }`,
      timestamp: new Date(),
      type: 'system',
    };

    await firstValueFrom(
      this.chatCollectorService.send(
        { cmd: ChatCommands.POST_MESSAGE },
        message
      )
    );
  }

  /**
   * Send tool retry message
   */
  private async sendToolRetryMessage(
    conversationId: string,
    persona: PersonaTelosDto,
    profile: ProfileDto,
    toolName: string,
    error: string,
    attempt: number
  ) {
    const message: Partial<ChatMessage> = {
      conversationId,
      senderId: persona.id,
      senderName: persona.name,
      recipientId: [profile.id],
      recipientName: [profile.profileName],
      content: `🔄 Tool ${toolName} failed (${error}). Retrying... (attempt ${attempt})`,
      timestamp: new Date(),
      type: 'system',
    };

    await firstValueFrom(
      this.chatCollectorService.send(
        { cmd: ChatCommands.POST_MESSAGE },
        message
      )
    );
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: string): boolean {
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /connection/i,
      /temporary/i,
      /try again/i,
      /503/,
      /502/,
      /504/,
    ];

    return retryablePatterns.some((pattern) => pattern.test(error));
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
