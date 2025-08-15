import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  ChatCommands,
  PersonaTelosCommands,
  ProfileCommands,
  PromptCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { ChatMessage, GeneratePrompt, PersonaTelosDto, ProfileDto } from '@optimistic-tanuki/models';
import { generatePersonaSystemMessage }
 from '@optimistic-tanuki/prompt-generation';

@Injectable()
export class AppService {
  constructor(
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
      const assistant: PersonaTelosDto[] = await firstValueFrom(
        this.telosDocsService.send(
          { cmd: PersonaTelosCommands.FIND },
          { name: 'Alex Generalis' }
        )
      );
      if (!assistant || assistant.length === 0) {
        throw new Error('Assistant not found');
      }
      const profile: ProfileDto = await firstValueFrom(
        this.profileService.send(
          { cmd: ProfileCommands.Get },
          { id: profileId }
        )
      );
      console.log(profile);
      if (!profile) {
        throw new Error('Profile not found');
      }

      console.log('Creating welcome chat for profile:', profileId);
      console.log('Using assistant:', assistant[0].name);
      console.log('profile Name:', profile.profileName);

      const systemPromptBase = generatePersonaSystemMessage(assistant[0]);
      console.log('System prompt base:', systemPromptBase);
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
            Inform the user that they can export their TELOS data at any time.
            TELOS data should be included at the end of the response in json format separated from the main response with \`---\` 
            JSON format should be with keys for goals, skills, interests, limitations, strengths, objectives, coreObjective, and overallProfileSummary.`
          },{
            role: 'user',
            content: `Hello, I'm ${profile.profileName}, and I just created my profile. I need help getting started, and I'm new here.`
          }
        ]
      };

      const initialResponse = await firstValueFrom(this.promptProxy.send({ cmd: PromptCommands.SEND }, message));
      console.log('Initial AI response:', initialResponse);
      const responseData = initialResponse.message.content;

      const [responseMessage, telosString] = responseData.split('---');
      console.log('User message:', responseMessage);
      console.log('TELOS data:', telosString);
      const chatBody: ChatMessage = {
        id: '',
        conversationId: '',
        senderId: assistant[0].id,
        senderName: assistant[0].name,
        recipientId: [profileId],
        recipientName: [profile.profileName],
        content: responseMessage,
        timestamp: new Date(),
        type: 'chat'
      };
      await firstValueFrom(this.chatCollectorService.send({ cmd: ChatCommands.POST_MESSAGE }, chatBody));
      return [];
    } catch (error) {
      console.error('Error processing new profile:', error);
      throw new RpcException('Failed to process new profile: ' + error.message);
    }
  }
}
