import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ProfileCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';

const LEARNING_APP_SCOPE = 'learning';
const GLOBAL_APP_SCOPE = 'global';
const LEARNING_LEARNER_ROLE = 'learning_learner';
const LEARNING_COURSE_DESIGNER_ROLE = 'learning_course_designer';

interface LearningProfile {
  id: string;
  userId: string;
  appScope: string;
  profileName?: string;
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
          name: await this.borrowedName(userId),
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

    await this.grantRole(created.id, LEARNING_LEARNER_ROLE);

    return created.id;
  }

  /**
   * The name to give a brand new learning profile.
   *
   * Borrowed from whatever the person is already called elsewhere on the
   * platform. This used to be the literal string 'Learner', which meant every
   * course anyone wrote was attributed to "Learner" on its own page. The
   * fallback is still 'Learner', because a name is better than an empty
   * byline and a userId is not a name.
   */
  private async borrowedName(userId: string): Promise<string> {
    try {
      const globalProfile = (await firstValueFrom(
        this.profileClient.send(
          { cmd: ProfileCommands.Get },
          { userId, appScope: GLOBAL_APP_SCOPE }
        )
      )) as LearningProfile | null;
      return globalProfile?.profileName?.trim() || 'Learner';
    } catch (error) {
      this.logger.warn(
        `Could not read a name for user ${userId}: ${(error as Error)?.message}`
      );
      return 'Learner';
    }
  }

  /**
   * Grants learning_course_designer to a profile that has asked to author.
   *
   * This is the only place that role is ever granted: nothing about
   * resolving or creating a profile hands it out implicitly, and there is no
   * second path that reaches it. Re-assigning an already-held role is
   * idempotent on the permissions service side (roles.service.assignRole
   * returns the existing assignment instead of erroring), so opting in twice
   * is a no-op here rather than a failure.
   */
  async optInAsAuthor(profileId: string): Promise<void> {
    await this.grantRole(profileId, LEARNING_COURSE_DESIGNER_ROLE);
  }

  async isCourseDesigner(profileId: string): Promise<boolean> {
    const roles = await this.getLearningRoles(profileId);
    return roles.some(
      (assignment) => assignment.role?.name === LEARNING_COURSE_DESIGNER_ROLE
    );
  }

  async getLearningRoles(
    profileId: string
  ): Promise<Array<{ role?: { name?: string } }>> {
    try {
      return (await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetUserRoles },
          { profileId, appScope: LEARNING_APP_SCOPE }
        )
      )) as Array<{ role?: { name?: string } }>;
    } catch (error) {
      this.logger.warn(
        `Failed to read learning roles for profile ${profileId}: ${
          (error as Error)?.message
        }`
      );
      return [];
    }
  }

  private async grantRole(profileId: string, roleName: string): Promise<void> {
    try {
      const role = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetByName },
          { name: roleName, appScope: LEARNING_APP_SCOPE }
        )
      );
      if (!role) {
        this.logger.warn(
          `${roleName} role not found; profile ${profileId} not granted it`
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
      // just means they start without the role until an admin fixes it.
      // Mirrors how profile.service.ts treats a failed role copy.
      this.logger.warn(
        `Failed to grant ${roleName} to profile ${profileId}: ${
          (error as Error)?.message
        }`
      );
    }
  }
}
