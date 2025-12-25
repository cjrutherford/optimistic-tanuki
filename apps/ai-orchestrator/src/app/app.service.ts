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
  ToolCall,
  ToolExecutionContext,
  ToolResult,
} from '@optimistic-tanuki/models';
import { LangChainService } from './langchain.service';
import { MCPToolExecutor } from './mcp-tool-executor';

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
    private readonly mcpExecutor: MCPToolExecutor
  ) {}

  private extractToolCallFromText(text?: string, idPrefix = 'extr_') {
    if (!text || typeof text !== 'string') return null;

    // 1) XML container <tool_call>...</tool_call>
    const xmlMatch = text.match(/<tool_call[\s\S]*?<\/tool_call>/i);
    if (xmlMatch) {
      const body = xmlMatch[0]
        .replace(/<tool_call[^>]*>|<\/tool_call>/gi, '')
        .trim();
      const obj: any = {};
      const tagRe = /<([^>\s]+)>([\s\S]*?)<\/\1>/g;
      let m: RegExpExecArray | null;
      while ((m = tagRe.exec(body))) {
        const key = m[1];
        const val = m[2].trim();
        if (key === 'arguments') {
          const args: Record<string, any> = {};
          let child: RegExpExecArray | null;
          const childRe = /<([^>\s]+)>([\s\S]*?)<\/\1>/g;
          while ((child = childRe.exec(val))) {
            const ck = child[1];
            const cv = child[2].trim();
            try {
              args[ck] = JSON.parse(cv);
            } catch {
              // keep as string or best-effort convert numbers/booleans
              if (/^\d+$/.test(cv)) args[ck] = Number(cv);
              else if (/^(true|false)$/i.test(cv))
                args[ck] = cv.toLowerCase() === 'true';
              else args[ck] = cv;
            }
          }
          obj.arguments = args;
        } else {
          try {
            obj[key] = JSON.parse(val);
          } catch {
            obj[key] = val;
          }
        }
      }

      if (obj.name) {
        return {
          id: `${idPrefix}${Date.now()}`,
          type: 'function' as const,
          function: {
            name: obj.name,
            arguments: JSON.stringify(obj.arguments ?? {}),
          },
        };
      }
    }

    // 2) Check for markdown code block with JSON (```json or just ```)
    const markdownMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (markdownMatch) {
      const codeContent = markdownMatch[1].trim();
      try {
        const parsed = JSON.parse(codeContent);
        // case: { "name": "tool_name", "arguments": { ... } }
        if (parsed.name && parsed.arguments) {
          return {
            id: `${idPrefix}${Date.now()}`,
            type: 'function' as const,
            function: {
              name: String(parsed.name),
              arguments: JSON.stringify(parsed.arguments),
            },
          };
        }
        // case: already OpenAI-style tool call
        if (
          parsed.type === 'function' &&
          parsed.function &&
          parsed.function.name
        ) {
          const args = parsed.function.arguments;
          return {
            id: parsed.id ?? `${idPrefix}${Date.now()}`,
            type: 'function' as const,
            function: {
              name: parsed.function.name,
              arguments:
                typeof args === 'string' ? args : JSON.stringify(args ?? {}),
            },
          };
        }
      } catch (e) {
        this.l.debug('Failed to parse markdown code block as JSON:', e);
      }
    }

    // 3) Try to extract first JSON block and parse it (without markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/m);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // case: { "name": "projects.create", "arguments": { ... } }
        if (parsed.name && parsed.arguments) {
          return {
            id: `${idPrefix}${Date.now()}`,
            type: 'function' as const,
            function: {
              name: String(parsed.name),
              arguments: JSON.stringify(parsed.arguments),
            },
          };
        }
        // case: already OpenAI-style tool call
        if (
          parsed.type === 'function' &&
          parsed.function &&
          parsed.function.name
        ) {
          // ensure arguments are stringified
          const args = parsed.function.arguments;
          return {
            id: parsed.id ?? `${idPrefix}${Date.now()}`,
            type: 'function' as const,
            function: {
              name: parsed.function.name,
              arguments:
                typeof args === 'string' ? args : JSON.stringify(args ?? {}),
            },
          };
        }
      } catch (e) {
        // ignore parse error - fallback null
      }
    }

    return null;
  }

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

      // Create welcome message using LangChain
      const welcomePrompt = `Hello, I'm ${profile.profileName}, and I just created my profile. I need help getting started, and I'm new here. Please ask me questions to help me clarify my goals and projects.`;

      const conversationSummary = `The user has just created a profile as a user of ${appId}. This app's description is: ${
        this.aiEnabledApps[appId] ?? 'No description available'
      }. The user may have limited information in their profile. Your goal is to assist the user in fleshing out their projects and goals. Behind the scenes, provide JSON output with potential TELOS data points. Inform the user that they can export their TELOS data at any time. TELOS is not an acronym, but a framework for maintaining focus and clarity for both AI and humans. TELOS data should be included at the end of the response in json format separated from the main response with '---'. JSON format should be with keys for goals, skills, interests, limitations, strengths, objectives, coreObjective, and overallProfileSummary.`;

      const responses: Partial<ChatMessage>[] = [];

      // Use LangChain to generate welcome response
      const result = await this.langChainService.executeConversation(
        assistant,
        profile,
        [],
        welcomePrompt,
        conversationSummary,
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

      // Post message to chat collector
      this.l.log('Posting welcome message:', newChatMessage);
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
        // Get conversation summary
        const conversationSummary = await this.summarizeConversation(
          conversation.messages,
          persona
        );

        this.l.log(`Processing conversation for persona: ${persona.name}`);

        // Use LangChain streaming for real-time updates
        try {
          const stream = this.langChainService.streamConversation(
            persona,
            profile,
            conversation.messages.slice(0, -1), // Exclude the last message (user's current message)
            lastMessage.content,
            conversationSummary,
            conversation.id
          );

          let accumulatedContent = '';
          let lastEmittedLength = 0;
          
          // Process stream and emit messages in real-time
          for await (const chunk of stream) {
            this.l.debug('Received chunk:', { type: chunk.type, contentLength: chunk.content?.length });
            
            if (chunk.type === 'chunk') {
              // Accumulate content
              accumulatedContent += chunk.content;
              
              // Emit intermediate message if we have enough new content (every 50 chars or so)
              if (accumulatedContent.length - lastEmittedLength > 50) {
                const newContent = accumulatedContent.substring(lastEmittedLength);
                lastEmittedLength = accumulatedContent.length;
                
                const intermediateMessage: Partial<ChatMessage> = {
                  conversationId: conversation.id,
                  senderId: persona.id,
                  senderName: persona.name,
                  recipientId: [profile.id],
                  recipientName: [profile.profileName],
                  content: newContent,
                  timestamp: new Date(),
                  type: 'chat_chunk', // New type for streaming chunks
                };
                
                // Post immediately for real-time updates
                await firstValueFrom(
                  this.chatCollectorService.send(
                    { cmd: ChatCommands.POST_MESSAGE },
                    intermediateMessage
                  )
                );
                this.l.debug('Emitted chunk with', newContent.length, 'characters');
              }
            } else if (chunk.type === 'final_response') {
              // Check if the final accumulated content contains a tool call
              const detectedToolCall = this.extractToolCallFromText(
                accumulatedContent,
                'stream_'
              ) as ToolCall | null;
              
              this.l.debug(
                'Final response - Detected tool call:',
                detectedToolCall ? detectedToolCall.function.name : 'none'
              );
              
              if (detectedToolCall) {
                // Extract user-facing content (before tool call)
                const userFacingContent = accumulatedContent
                  .replace(/```(?:json)?\s*\n?[\s\S]*?```/g, '')
                  .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
                  .replace(/\{["\s]*name["\s]*:["\s]*[^}]+\}/g, '')
                  .trim();
                
                // Emit user-facing content if present
                if (userFacingContent.length > 0) {
                  const thoughtMessage: Partial<ChatMessage> = {
                    conversationId: conversation.id,
                    senderId: persona.id,
                    senderName: persona.name,
                    recipientId: [profile.id],
                    recipientName: [profile.profileName],
                    content: userFacingContent,
                    timestamp: new Date(),
                    type: 'chat',
                  };
                  
                  await firstValueFrom(
                    this.chatCollectorService.send(
                      { cmd: ChatCommands.POST_MESSAGE },
                      thoughtMessage
                    )
                  );
                  responses.push(thoughtMessage);
                }
                
                // Emit tool call notification
                const toolCallMessage: Partial<ChatMessage> = {
                  conversationId: conversation.id,
                  senderId: persona.id,
                  senderName: persona.name,
                  recipientId: [profile.id],
                  recipientName: [profile.profileName],
                  content: `🔧 Calling tool: ${detectedToolCall.function.name}`,
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

                // Execute the tool via the MCP executor
                try {
                  const ctx: ToolExecutionContext = {
                    profileId: profile.id,
                    userId: profile.id,
                    conversationId: conversation.id,
                  };

                  this.l.log('Executing tool call:', {
                    name: detectedToolCall.function.name,
                    arguments: detectedToolCall.function.arguments
                  });

                  const result: ToolResult =
                    await this.mcpExecutor.executeToolCall(detectedToolCall, ctx);

                  const resultContent = result.success
                    ? typeof result.result === 'string'
                      ? result.result
                      : JSON.stringify(result.result, null, 2)
                    : JSON.stringify({
                        error: result.error,
                        message: result.error?.message || 'Tool execution failed',
                      }, null, 2);

                  const toolResultMessage: Partial<ChatMessage> = {
                    conversationId: conversation.id,
                    senderId: persona.id,
                    senderName: persona.name,
                    recipientId: [profile.id],
                    recipientName: [profile.profileName],
                    content: `✅ Tool result (${detectedToolCall.function.name}):\n${resultContent}`,
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
                } catch (toolError) {
                  this.l.error('Error executing tool call:', toolError);
                  const errorMessage: Partial<ChatMessage> = {
                    conversationId: conversation.id,
                    senderId: persona.id,
                    senderName: persona.name,
                    recipientId: [profile.id],
                    recipientName: [profile.profileName],
                    content: `⚠️ Error executing tool (${detectedToolCall.function.name}): ${toolError.message}`,
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

                this.l.log('Tool call processing complete');
              } else {
                // No tool call - emit final response normally
                const { content, telosData } = this.parseTelosResponse(
                  accumulatedContent
                );

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

                this.l.log('Final response emitted (no tool call)');
              }
            }
          }
        } catch (streamError) {
          this.l.error(
            'Streaming error, falling back to non-streaming:',
            streamError
          );

          // Fallback to non-streaming execution
          const result = await this.langChainService.executeConversation(
            persona,
            profile,
            conversation.messages.slice(0, -1),
            lastMessage.content,
            conversationSummary,
            conversation.id
          );

          // Emit intermediate steps as tool call messages
          if (result.intermediateSteps && result.intermediateSteps.length > 0) {
            for (const step of result.intermediateSteps) {
              if (step.action) {
                const toolCallMessage: Partial<ChatMessage> = {
                  conversationId: conversation.id,
                  senderId: persona.id,
                  senderName: persona.name,
                  recipientId: [profile.id],
                  recipientName: [profile.profileName],
                  content: `🔧 Calling tool: ${step.action.tool}`,
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
              }
            }
          }

          // Emit final response
          const { content, telosData } = this.parseTelosResponse(
            result.response
          );

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
        }
      }

      this.l.log(
        `Conversation update complete. ${responses.length} messages emitted.`
      );
      return responses;
    } catch (e) {
      this.l.log('Error updating conversation:', e);
      throw new RpcException('Failed to update conversation: ' + e.message);
    }
  }

  private async getPersona(options: {
    name?: string;
    id?: string;
  }): Promise<PersonaTelosDto> {
    try {
      const personas = await firstValueFrom(
        this.telosDocsService.send({ cmd: PersonaTelosCommands.FIND }, options)
      );

      if (!personas || personas.length === 0) {
        throw new Error('Persona not found');
      }

      return personas[0];
    } catch (error) {
      this.l.error('Error getting persona:', error);
      throw new RpcException('Failed to get persona: ' + error.message);
    }
  }

  private async summarizeConversation(
    messages: ChatMessage[],
    persona: PersonaTelosDto
  ): Promise<string> {
    // Simple summarization - could be enhanced with LangChain summarization chain
    const recentMessages = messages.slice(-10); // Last 10 messages
    const summary = recentMessages
      .map((m) => `${m.senderName}: ${m.content}`)
      .join('\n');

    return `Recent conversation:\n${summary}`;
  }

  /**
   * Parse TELOS data from response
   * Format: content---{json}
   */
  private parseTelosResponse(response: string): {
    content: string;
    telosData: any | null;
  } {
    const parts = response.split('---');

    if (parts.length > 1) {
      const content = parts[0].trim();
      try {
        const telosData = JSON.parse(parts[1].trim());
        return { content, telosData };
      } catch (e) {
        this.l.warn('Failed to parse TELOS data:', e);
        return { content: response, telosData: null };
      }
    }

    return { content: response, telosData: null };
  }
}
