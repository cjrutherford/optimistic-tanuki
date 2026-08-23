import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ProfileCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';

const LEARNING_APP_SCOPE = 'learning';
const LEARNING_LEARNER_ROLE = 'learning_learner';

interface LearningProfile {
  id: string;
  userId: string;
  appScope: string;
}

/**
 * Resolves the acting user's learning-scoped profile, creating it on first
 * visit.
 *
 * Profile is already per-app-scoped (userId + appScope, unique), so this does
 * not invent a new identity concept, it just fills in the "learning" row the
 * first time someone shows up. The JWT's profileId belongs to whichever app
 * minted the token, which is not necessarily learning, so every learning
 * route must resolve its own profile rather than trust the token's.
 *
 * A profile created here starts with no role at all, which is the gap this
 * closes: it is granted learning_learner immediately, in the learning scope,
 * so the seeded roles actually apply to a brand new learner.
 */
@Injectable()
export class LearningProfileResolver {
  private readonly logger = new Logger(LearningProfileResolver.name);

  constructor(
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy
  ) {}

  async resolveProfileId(userId: string): Promise<string> {
    // Never called with an empty userId in practice (every caller guards on
    // req.user first), but a hard failure here is safer than quietly
    // creating an anonymous profile if that ever changes.
    if (!userId) {
      throw new Error('Cannot resolve a learning profile without a userId');
    }

    const existing = (await firstValueFrom(
      this.profileClient.send(
        { cmd: ProfileCommands.Get },
        { userId, appScope: LEARNING_APP_SCOPE }
      )
    )) as LearningProfile | null;
    if (existing) return existing.id;

    const created = (await firstValueFrom(
      this.profileClient.send(
        { cmd: ProfileCommands.Create },
        {
          userId,
          name: 'Learner',
          description: '',
          profilePic: '',
          coverPic: '',
          bio: '',
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          appScope: LEARNING_APP_SCOPE,
          copyPermissionsFromGlobalProfile: false,
        }
      )
    )) as LearningProfile;

    await this.grantLearnerRole(created.id);

    return created.id;
  }

  private async grantLearnerRole(profileId: string): Promise<void> {
    try {
      const role = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetByName },
          { name: LEARNING_LEARNER_ROLE, appScope: LEARNING_APP_SCOPE }
        )
      );
      if (!role) {
        this.logger.warn(
          `${LEARNING_LEARNER_ROLE} role not found; profile ${profileId} created without a role`
        );
        return;
      }
      await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.Assign },
          {
            roleId: role.id,
            profileId,
            appScopeId: role.appScope?.id ?? role.appScopeId,
          }
        )
      );
    } catch (error) {
      // A failed role grant should not block someone from using the site; it
      // just means they start without learning_learner until an admin fixes
      // it. Mirrors how profile.service.ts treats a failed role copy.
      this.logger.warn(
        `Failed to grant ${LEARNING_LEARNER_ROLE} to profile ${profileId}: ${
          (error as Error)?.message
        }`
      );
    }
  }
}
