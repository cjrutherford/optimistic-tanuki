import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PersonaTelosCommands, ProfileCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { PersonaTelosDto } from '@optimistic-tanuki/models';

@Injectable()
export class AppService {
  constructor(
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsService: ClientProxy,
    @Inject(ServiceTokens.PROMPT_PROXY)
    private readonly promptProxy: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService: ClientProxy,
  ) {}

  async processNewProfile(profileId: string) {
    try {
      const assistant: PersonaTelosDto[] = await firstValueFrom(this.telosDocsService.send({ cmd: PersonaTelosCommands.FIND }, { name: 'Alex Generalis' }));
      if (!assistant || assistant.length === 0) {
        throw new Error('Assistant not found');
      }
      const profile = await firstValueFrom(this.profileService.send({ cmd: ProfileCommands.Get }, { id: profileId }));
      console.log(profile);
      if (!profile) {
        throw new Error('Profile not found');
      }

     console.log('Creating welcome chat for profile:', profileId);
     console.log('Using assistant:', assistant[0].name);
     console.log('profile Name:', profile.name); 

    } catch (error) {
      console.error('Error processing new profile:', error);
      throw new RpcException('Failed to process new profile: ' + error.message);
    }
  }

}
