import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import { CreateProfileDto, RegisterRequest } from '@optimistic-tanuki/models';
import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  RoleInitBuilder,
  RoleInitService,
} from '@optimistic-tanuki/permission-lib';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RegisterAccountBootstrapService {
  constructor(
    private readonly authClient: Pick<ClientProxy, 'send'>,
    private readonly profileClient: Pick<ClientProxy, 'send'>,
    private readonly roleInit: Pick<RoleInitService, 'processNow'>,
  ) {}

  async register(data: RegisterRequest, appScope: string) {
    const result = await firstValueFrom(
      this.authClient.send({ cmd: AuthCommands.Register }, data),
    );

    const newProfile: CreateProfileDto & { appScope: string } = {
      userId: result.data.user.id,
      name: `${result.data.user.firstName} ${result.data.user.lastName}`,
      coverPic: '',
      profilePic: '',
      bio: '',
      location: '',
      description: '',
      occupation: '',
      interests: '',
      skills: '',
      appScope: appScope === 'owner-console' ? 'global' : appScope,
    };

    const createdProfile = await firstValueFrom(
      this.profileClient.send({ cmd: ProfileCommands.Create }, newProfile),
    );

    if (appScope === 'owner-console') {
      await this.roleInit.processNow(
        new RoleInitBuilder()
          .setScopeName('global')
          .setProfile(createdProfile.id)
          .assignOwnerRole()
          .addOwnerScopeDefaults()
          .addAssetOwnerPermissions()
          .build(),
      );
      return result;
    }

    const effectiveScope = appScope || 'global';
    await this.roleInit.processNow(
      new RoleInitBuilder()
        .setScopeName(effectiveScope)
        .setProfile(createdProfile.id)
        .addDefaultProfileOwner(createdProfile.id, effectiveScope)
        .addAppScopeDefaults()
        .addAssetOwnerPermissions()
        .build(),
    );

    return result;
  }
}
