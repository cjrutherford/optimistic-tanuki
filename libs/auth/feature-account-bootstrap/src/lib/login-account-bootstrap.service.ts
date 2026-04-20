import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import {
  CreateProfileDto,
  LoginRequest,
  ProfileDto,
} from '@optimistic-tanuki/models';
import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  RoleInitBuilder,
  RoleInitService,
} from '@optimistic-tanuki/permission-lib';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LoginAccountBootstrapService {
  constructor(
    private readonly authClient: Pick<ClientProxy, 'send'>,
    private readonly profileClient: Pick<ClientProxy, 'send'>,
    private readonly roleInit: Pick<RoleInitService, 'processNow'>,
  ) {}

  async login(data: LoginRequest, appScope: string) {
    const userIdResult: string | { userId?: string; id?: string } =
      await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.UserIdFromEmail },
          { email: data.email },
        ),
      );
    const userId =
      typeof userIdResult === 'string'
        ? userIdResult
        : userIdResult?.userId || userIdResult?.id;

    if (!userId) {
      throw new Error(`Unable to resolve userId for email=${data.email}`);
    }

    const profiles = (await firstValueFrom(
      this.profileClient.send(
        { cmd: ProfileCommands.GetAll },
        { where: { userId } },
      ),
    )) as ProfileDto[];

    const effectiveAppScope =
      appScope === 'owner-console' ? 'global' : appScope;
    let appScopedProfile = profiles.find(
      (profile) => profile.appScope === effectiveAppScope,
    );
    const globalProfile = profiles.find(
      (profile) => !profile.appScope || profile.appScope === 'global',
    );
    const seedProfile = globalProfile || profiles[0] || null;

    if (!appScopedProfile && effectiveAppScope !== 'global') {
      if (!seedProfile) {
        throw new Error('No profile available for user');
      }

      const newProfile: CreateProfileDto & {
        appScope: string;
        copyPermissionsFromGlobalProfile?: boolean;
      } = {
        userId: seedProfile.userId,
        name: seedProfile.profileName || data.email,
        description: '',
        profilePic: seedProfile.avatarUrl || '',
        coverPic: '',
        bio: seedProfile.bio || '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        appScope: effectiveAppScope,
        copyPermissionsFromGlobalProfile: false,
      };

      const createdProfile = (await firstValueFrom(
        this.profileClient.send({ cmd: ProfileCommands.Create }, newProfile),
      )) as ProfileDto;

      const roleInitOptions = new RoleInitBuilder()
        .setScopeName(effectiveAppScope)
        .setProfile(createdProfile.id)
        .addDefaultProfileOwner(createdProfile.id, effectiveAppScope)
        .addAppScopeDefaults()
        .addAssetOwnerPermissions()
        .build();

      await this.roleInit.processNow(roleInitOptions);
      appScopedProfile = createdProfile;
    }

    const profileToUse =
      effectiveAppScope === 'global'
        ? globalProfile || profiles[0] || null
        : appScopedProfile;

    if (!profileToUse) {
      throw new Error('No profile available for user');
    }

    return firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.Login },
        { ...data, profileId: profileToUse.id },
      ),
    );
  }
}
