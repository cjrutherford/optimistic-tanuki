import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  ChatCommands,
  PersonaTelosCommands,
  ProfileCommands,
  PromptCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import {
  ChatConversation,
  ChatMessage,
  GeneratePrompt,
  PersonaTelosDto,
  ProfileDto,
  ToolExecutionContext,
  ToolResult,
} from '@optimistic-tanuki/models';
import { ToolsService } from './tools.service';
import { generatePersonaSystemMessage } from '@optimistic-tanuki/prompt-generation';
import { transformMcpToolsToOpenAI } from './tool-formatter';
import { MCPToolExecutor } from './mcp-tool-executor';

@Injectable()
export class AppService {
  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsService: ClientProxy,
    @Inject(ServiceTokens.PROMPT_PROXY)
    private readonly promptProxy: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService: ClientProxy,
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatCollectorService: ClientProxy,
    @Inject('ai-enabled-apps')
    private readonly aiEnabledApps: { [key: string]: string },
    private readonly toolsService: ToolsService,
    private readonly mcpExecutor: MCPToolExecutor
  ) {}

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
      this.l.log(profile);
      if (!profile) {
        throw new Error('Profile not found');
      }

      this.l.log(`Creating welcome chat for profile: '${profileId}'`);
      this.l.log(`Using assistant: '${assistant.name}'`);
      this.l.log(`profile Name: '${profile.profileName}'`);

      const systemPromptBase = generatePersonaSystemMessage(assistant);
      this.l.log(`System prompt base: '${systemPromptBase}'`);
      const message: GeneratePrompt = {
        model: 'llama3.2:3b',
        stream: false,
        messages: [
          {
            role: 'system',
            content: `${systemPromptBase}
            The user has just created a profile as a user of ${appId}. This app's description is: ${
              this.aiEnabledApps[appId] ?? 'No description available'
            }. 
            The user's profile name is ${profile.profileName}. 
            The user may have limited information in their profile.
            your goal is to assist the user in fleshing out their projects and goals. 
            behind the scenes, provide JSON output with potential TELOS data points to add to either the users' or the project's telos data.
            Inform the user that they can export their TELOS data at any time. TELOS is not an acronym, but a framework for maintaining focus and clarity for both AI and humans.
            TELOS data should be included at the end of the response in json format separated from the main response with \`---\` 
            JSON format should be with keys for goals, skills, interests, limitations, strengths, objectives, coreObjective, and overallProfileSummary.`,
          },
          {
            role: 'user',
            content: `Hello, I'm ${profile.profileName}, and I just created my profile. I need help getting started, and I'm new here. Please ask me questions to help me clarify my goals and projects.`,
          },
        ],
      };

      const initialResponse = await firstValueFrom(
        this.promptProxy.send({ cmd: PromptCommands.SEND }, message)
      );
      this.l.log('Initial AI response: ' + initialResponse);
      const responseData = initialResponse.message.content;

      const [responseMessage, telosString] = responseData.split('---');
      this.l.log(`User message: '${responseMessage}'`);
      this.l.log(`TELOS data: '${telosString}'`);
      const chatBody: Partial<ChatMessage> = {
        senderId: assistant.id,
        senderName: assistant.name,
        recipientId: [profileId],
        recipientName: [profile.profileName],
        content: responseMessage,
        timestamp: new Date(),
        type: 'chat',
      };
      await firstValueFrom(
        this.chatCollectorService.send(
          { cmd: ChatCommands.POST_MESSAGE },
          chatBody
        )
      );
      return [];
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
      // this.l.log(JSON.stringify(aiPersonas));

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
        const systemPrompt = generatePersonaSystemMessage(persona);
        // // If this is a brand new conversation with the placeholder, generate
        // // a greeting message and post it immediately so the client doesn't
        // // continue to show the placeholder.
        // const isNewConversation =
        //   conversation.messages.length === 1 &&
        //   conversation.messages[0].content ===
        //     'Creating new AI assistant conversation...';

        // if (isNewConversation) {
        //   this.l.log(
        //     'Detected new conversation placeholder — generating greeting.'
        //   );
        //   const response = await this.processNewProfile(
        //     conversation.messages[0].senderId,
        //     conversation.metadata?.appId || 'forgeofwill'
        //     conve
        //   );
        //   return response;
        // }

        const conversationSummary = await this.summarizeConversation(
          conversation.messages,
          systemPrompt
        );
        const toolsMeta = await this.toolsService.listTools().catch((e) => []);
        // Transform MCP tools to OpenAI format for Ollama's OpenAI-compatible API
        // Pass user profile ID to enhance tool parameter descriptions
        const openAITools = transformMcpToolsToOpenAI(toolsMeta, profile.id);
        console.log('Transformed tools:', openAITools[0]);

        this.l.log(`Conversation summary: '${conversationSummary}'`);
        const personaPrompt: GeneratePrompt = {
          model: 'llama3.2:3b',
          stream: false,
          tools: openAITools,
          messages: [
            {
              role: 'system',
              content: `${systemPrompt}
                
Your previous conversation summary is: '${conversationSummary}'

CURRENT USER INFORMATION:
- User Profile ID: ${profile.id}
- User Name: ${profile.profileName}
- ALWAYS use ${profile.id} for any 'userId', 'profileId', 'createdBy', or 'members' parameters

TOOL USAGE GUIDELINES:
- Use ONE tool at a time - you can only call a single tool per response
- If a task requires multiple steps, call one tool, wait for its response, then call the next tool
- Some tools depend on data from other tools - use the response from one tool to inform the next tool call
- After completing all necessary tool calls, ALWAYS provide a final natural language response to the user explaining what was accomplished
- Your final response should summarize the actions taken and the results

PROJECT-RELATED WORKFLOWS:
- Tasks, Risks, Changes, and Journal Entries are ALL tied to specific projects
- BEFORE creating or listing any of these items, you MUST first call 'list_projects' with userId: ${profile.id}
- From the list_projects response, select the appropriate projectId
- Then use that projectId when creating/listing tasks, risks, changes, or journal entries
- If no suitable project exists, create one first using 'create_project'

PARAMETER USAGE RULES:
- userId/profileId/createdBy: ALWAYS use ${profile.id} (the current user)
- members: ALWAYS use [${profile.id}] (include the current user)
- projectId: MUST come from a 'list_projects' call first - select from available projects

You have access to tools that can help you complete tasks. Use them when appropriate.
Simply respond naturally to the user, and call tools when needed to accomplish their requests.

If the intent is to call another tool, ONLY responsd with the tool call JSON as specified in the tool calling protocol.
DO NOT provide non-JSON responses when tools should be called. ONLY provide non-JSON responses when you have completed all tool calls and are providing a final answer to the user.
`,
            },
            {
              role: 'user',
              content: lastMessage.content,
            },
          ],
        };

        // Robust JSON extractor: try full parse, then extract first {...} block
        const tryParseJson = (s: string | undefined) => {
          if (!s || typeof s !== 'string') return null;
          try {
            return JSON.parse(s.trim());
          } catch {
            const m = s.match(/\{[\s\S]*\}/m);
            if (m && m[0]) {
              try {
                return JSON.parse(m[0]);
              } catch {
                return null;
              }
            }
            return null;
          }
        };

        let stopConditionMet = false;
        let iterations = 0;
        const MAX_ITER = 6;
        while (!stopConditionMet) {
          iterations++;
          if (iterations > MAX_ITER) {
            this.l.warn(
              `Max tool-call iterations (${MAX_ITER}) reached for persona ${persona.id}. Aborting loop.`
            );
            // provide a fallback message so client isn't blocked
            responses.push({
              conversationId: conversation.id,
              senderId: persona.id,
              senderName: persona.name,
              recipientId: [profile.id],
              recipientName: [profile.profileName],
              content:
                'I am unable to complete this action right now. Please try again later.',
              timestamp: new Date(),
              type: 'chat',
            });
            break;
          }

          this.l.log(`Persona prompt: '${JSON.stringify(personaPrompt)}'`);
          const response = await firstValueFrom(
            this.promptProxy.send({ cmd: PromptCommands.SEND }, personaPrompt)
          );

          // Check if response has OpenAI-format tool_calls
          if (
            response.message.tool_calls &&
            response.message.tool_calls.length > 0
          ) {
            // Handle OpenAI-format tool calls - only process ONE tool at a time
            if (response.message.tool_calls.length > 1) {
              this.l.warn(
                `LLM returned ${response.message.tool_calls.length} tool calls, but only processing the first one. ` +
                  `The LLM should call one tool at a time.`
              );
            }

            const toolCall = response.message.tool_calls[0]; // Process first tool call only

            // Create execution context
            const executionContext: ToolExecutionContext = {
              userId: profile.id,
              profileId: profile.id,
              conversationId: conversation.id,
            };

            // Execute tool call using standardized executor
            const toolResult: ToolResult = await this.mcpExecutor.executeToolCall(
              toolCall,
              executionContext
            );

            this.l.log(
              `Tool '${toolResult.toolName}' executed with success=${toolResult.success}`
            );
            this.l.debug(`Tool result: ${JSON.stringify(toolResult)}`);

            // Add the assistant's tool call message (only include the one tool we're processing)
            personaPrompt.messages.push({
              role: 'assistant',
              content: response.message.content || '',
              tool_calls: [toolCall], // Only include the first tool call
            } as any);

            // Add the tool response - format based on success/failure
            let toolResponseContent: string;
            if (toolResult.success) {
              toolResponseContent =
                typeof toolResult.result === 'string'
                  ? toolResult.result
                  : JSON.stringify(toolResult.result);
            } else {
              // Include error information in the response
              toolResponseContent = JSON.stringify({
                error: toolResult.error,
                message: `Tool execution failed: ${toolResult.error?.message}`,
              });
            }

            personaPrompt.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResponseContent,
            } as any);

            continue; // Continue the loop to get the final response
          }

          const content = response.message.content;
          const parsedResponse = tryParseJson(content);

          // Normalize LLM response if it uses { name: "tool", parameters: { ... } } format
          if (
            parsedResponse &&
            parsedResponse.name &&
            parsedResponse.parameters &&
            !parsedResponse.tool
          ) {
            parsedResponse.tool = parsedResponse.name;
            parsedResponse.args = parsedResponse.parameters;
          }

          if (parsedResponse && parsedResponse.tool) {
            // Legacy JSON-format tool calling (kept for backward compatibility)
            // Convert to standard OpenAI format and use executor
            const legacyToolCall = {
              id: `legacy_${Date.now()}`,
              type: 'function' as const,
              function: {
                name: parsedResponse.tool,
                arguments: JSON.stringify(parsedResponse.args || {}),
              },
            };

            // Create execution context
            const executionContext: ToolExecutionContext = {
              userId: profile.id,
              profileId: profile.id,
              conversationId: conversation.id,
            };

            // Execute using standardized executor
            const toolResult: ToolResult = await this.mcpExecutor.executeToolCall(
              legacyToolCall,
              executionContext
            );

            this.l.log(
              `Legacy tool '${toolResult.toolName}' executed with success=${toolResult.success}`
            );

            // Add the tool response back to the persona prompt for further processing
            const responseContent = toolResult.success
              ? typeof toolResult.result === 'string'
                ? toolResult.result
                : JSON.stringify(toolResult.result)
              : JSON.stringify({
                  error: toolResult.error,
                  message: `Tool failed: ${toolResult.error?.message}`,
                });

            personaPrompt.messages.push({
              role: 'assistant',
              content: `The tool '${parsedResponse.tool}' returned the following response: ${responseContent}. Please use this information to generate your next action.`,
            });
          } else if (
            parsedResponse &&
            (parsedResponse.stop ||
              parsedResponse.response ||
              parsedResponse.message)
          ) {
            this.l.log('Stop condition received from LLM.');
            stopConditionMet = true;
            // Prefer explicit response fields from the JSON, otherwise fallback to raw content
            const finalText =
              parsedResponse.response ?? parsedResponse.message ?? content;
            this.l.debug(`Final response text: '${finalText}'`);
            const newChatMessage: Partial<ChatMessage> = {
              conversationId: conversation.id,
              senderId: persona.id,
              senderName: persona.name,
              recipientId: [profile.id],
              recipientName: [profile.profileName],
              content: finalText,
              timestamp: new Date(),
              type: 'chat',
            };
            responses.push(newChatMessage);
          } else if (!parsedResponse && content && content.trim()) {
            // LLM didn't follow the strict tool JSON protocol but returned human-readable text.
            // Treat this as the final response and return it to the client.
            this.l.log(
              'LLM provided final response without tool call - sending to user.'
            );
            stopConditionMet = true;
            const newChatMessage: Partial<ChatMessage> = {
              conversationId: conversation.id,
              senderId: persona.id,
              senderName: persona.name,
              recipientId: [profile.id],
              recipientName: [profile.profileName],
              content: content,
              timestamp: new Date(),
              type: 'chat',
            };
            responses.push(newChatMessage);
          } else {
            this.l.log('Invalid or unexpected response from LLM.');
            stopConditionMet = true; // Break the loop to avoid infinite processing
          }
        }
      }

      this.l.log('Responses from AI personas:', responses);
      for (const response of responses) {
        this.l.log('Posting message to chat collector:', response);
        await firstValueFrom(
          this.chatCollectorService.send(
            { cmd: ChatCommands.POST_MESSAGE },
            response
          )
        );
      }
      this.l.log('All AI persona messages posted successfully.');
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
      const persona = await firstValueFrom(
        this.telosDocsService.send(
          { cmd: PersonaTelosCommands.FIND },
          { ...options }
        )
      );
      if (!persona || persona.length === 0) {
        throw new Error('Persona not found');
      }
      this.l.log('Personas found:', persona.map((p) => p.name).join(','));
      return persona[0];
    } catch (e) {
      this.l.error('Error getting persona:', e);
      throw new RpcException('Failed to get persona: ' + e.message);
    }
  }

  private async summarizeConversation(
    messages: ChatMessage[],
    personaPrompt: string
  ) {
    try {
      if (
        messages.length === 1 &&
        messages[0].content == 'Creating new AI assistant conversation...'
      ) {
        messages[0].content =
          'The user is just starting out. Please introduce yourself and what your available to help with.';
      }
      const prompt: GeneratePrompt = {
        model: 'llama3.2:3b',
        stream: false,
        messages: [
          {
            role: 'system',
            content: `${personaPrompt}
              Please summarize the conversation and pick out  keywords from the previous messages.
              keep the summary to include all information, but in the smallest possible form.
              This is for the purpose of providing context for further prompting.
            `,
          },
          {
            role: 'user',
            content: messages.map((msg) => msg.content).join('\n\n\n'),
          },
        ],
      };
      const response = await firstValueFrom(
        this.promptProxy.send({ cmd: PromptCommands.SEND }, prompt)
      );
      this.l.log('Conversation summary response:', response);
      return response.message.content;
    } catch (e) {
      this.l.error('Error summarizing conversation:', e);
      throw new RpcException('Failed to summarize conversation: ' + e.message);
    }
  }
}
