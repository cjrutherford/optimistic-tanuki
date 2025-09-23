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
import { ChatConversation, ChatMessage, GeneratePrompt, PersonaTelosDto, ProfileDto } from '@optimistic-tanuki/models';
import { generatePersonaSystemMessage }
 from '@optimistic-tanuki/prompt-generation';

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
    private readonly chatCollectorService: ClientProxy
  ) {}

  async processNewProfile(profileId: string) {
    try {
      const assistant: PersonaTelosDto = await this.getPersona({ name: 'Alex Generalis' });
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
            The user has just created a profile for the Forge of will a small personal project management platform. 
            your goal is to assist the user in fleshing out their projects and goals. 
            behind the scenes, provide JSON output with potential TELOS data points to add to either the users' or the project's telos data.
            Inform the user that they can export their TELOS data at any time. TELOS is not an acronym, but a framework for maintaining focus and clarity for both AI and humans.
            TELOS data should be included at the end of the response in json format separated from the main response with \`---\` 
            JSON format should be with keys for goals, skills, interests, limitations, strengths, objectives, coreObjective, and overallProfileSummary.`
          },{
            role: 'user',
            content: `Hello, I'm ${profile.profileName}, and I just created my profile. I need help getting started, and I'm new here.`
          }
        ]
      };

      const initialResponse = await firstValueFrom(this.promptProxy.send({ cmd: PromptCommands.SEND }, message));
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
        type: 'chat'
      };
      await firstValueFrom(this.chatCollectorService.send({ cmd: ChatCommands.POST_MESSAGE }, chatBody));
      return [];
    } catch (error) {
      console.trace(error);
      this.l.error('Error processing new profile:', error);
      throw new RpcException('Failed to process new profile: ' + error.message);
    }
  }

  async updateConversation(data: {conversation: ChatConversation, aiPersonas: PersonaTelosDto[]}): Promise<Partial<ChatMessage>[]> {
    try{
      const { conversation, aiPersonas } = data;
      this.l.log(JSON.stringify(aiPersonas))
      //✅  1. build the system prompt for each of the personas.
      //✅  2. call the prompt proxy with instructions to summarize the conversation so far from the messages array. 
      //✅  3. send a message to each of the api personas separately with the updated conversation and the latest message from the user.
      //✅  4. send separate chat messages from each persona to the chat collector.
      //TODO:: ❌ 5. analyze the non-ai messages for profile TELOS data points and update the profile telos

      const lastMessage = conversation.messages[conversation.messages.length - 1];
      const profile: ProfileDto = await firstValueFrom(this.profileService.send({ cmd: ProfileCommands.Get }, { id: lastMessage.senderId }))
      const responses: Partial<ChatMessage>[] = [];
      for ( const persona of aiPersonas ) {
        const systemPrompt = generatePersonaSystemMessage(persona);
        const conversationSummary = await this.summarizeConversation(conversation.messages, systemPrompt);
        this.l.log(`Conversation summary: '${conversationSummary}'`);
        const personaPrompt: GeneratePrompt = {
          model: 'llama3.2:3b',
          stream: false,
          messages: [
            {
              role: 'system',
              content: `
                ${systemPrompt}
                your previous conversation summary is: '${conversationSummary}'
              ` 
            },
            {
              role: 'user',
              content: lastMessage.content
            }
          ]
        };
        this.l.log(`Persona prompt: '${JSON.stringify(personaPrompt)}'`);
        const response = await firstValueFrom(this.promptProxy.send({ cmd: PromptCommands.SEND }, personaPrompt));
        this.l.log(`Persona response: '${response}'`);
        const newChatMessage: Partial<ChatMessage> = {
          conversationId: conversation.id,
          senderId: persona.id,
          senderName: persona.name,
          recipientId: [profile.id],
          recipientName: [profile.profileName],
          content: response.message.content,
          timestamp: new Date(),
          type: 'chat'
        };
        responses.push(newChatMessage);
      }
      this.l.log('Responses from AI personas:', responses);
      for (const response of responses) {
        this.l.log('Posting message to chat collector:', response);
        await firstValueFrom(this.chatCollectorService.send({ cmd: ChatCommands.POST_MESSAGE }, response));
      }
      this.l.log('All AI persona messages posted successfully.');
      return responses;
    } catch(e) {
      this.l.log('Error updating conversation:', e);
      throw new RpcException('Failed to update conversation: ' + e.message);
    }
  }

  private async getPersona(options: { name?: string, id?: string}): Promise<PersonaTelosDto> {
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
      this.l.log('Personas found:', persona.map(p => p.name).join(','));
      return persona[0];
    } catch (e) {
      this.l.error('Error getting persona:', e);
      throw new RpcException('Failed to get persona: ' + e.message);
    }
  }

  private async summarizeConversation(messages: ChatMessage[], personaPrompt: string) {
    try {
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
            content: messages.map(msg => msg.content).join('\n\n\n')
          }
        ]
      };
      const response = await firstValueFrom(this.promptProxy.send({ cmd: PromptCommands.SEND }, prompt));
      this.l.log('Conversation summary response:', response);
      return response.message.content;

    } catch (e) {
      this.l.error('Error summarizing conversation:', e);
      throw new RpcException('Failed to summarize conversation: ' + e.message);
    }
  }
}
