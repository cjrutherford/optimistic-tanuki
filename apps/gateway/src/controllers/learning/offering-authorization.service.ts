import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  LearningCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  authorizeOfferingAction,
  OfferingAuthorizationAction,
  OfferingOwnership,
} from '@optimistic-tanuki/learning-domain';

const LEARNING_APP_SCOPE = 'learning';
const GLOBAL_APP_SCOPE = 'global';
const LEARNING_ADMIN_ROLE = 'learning_admin';
const LEARNING_COURSE_DESIGNER_ROLE = 'learning_course_designer';
// Platform owners answer for everything the platform does, learning included.
// They hold these roles in the global app scope, not the learning one, which
// is why this needs the token's own profileId as well as the learning
// profileId: the two are not the same row.
const PLATFORM_OWNER_ROLE_NAMES = new Set(['owner', 'global_admin']);

/**
 * The single place that decides whether a caller may create, update, delete,
 * or manage co-editors on an offering.
 *
 * This is the I/O shell around the pure `authorizeOfferingAction` decision in
 * learning-domain: it gathers the caller's roles and the offering's
 * ownership record, then hands them to that function. Keeping the decision
 * itself pure and this class thin means the hard cases are tested once,
 * without a database or a permissions service, in learning-domain.spec.ts.
 */
@Injectable()
export class OfferingAuthorizationService {
  private readonly logger = new Logger(OfferingAuthorizationService.name);

  constructor(
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    @Inject(ServiceTokens.LEARNING_SERVICE)
    private readonly learningService: ClientProxy
  ) {}

  async authorize(
    learningProfileId: string,
    tokenProfileId: string | undefined,
    action: OfferingAuthorizationAction,
    offeringId?: string
  ): Promise<boolean> {
    const [learningRoleNames, globalRoleNames, ownership] = await Promise.all([
      this.getRoleNames(learningProfileId, LEARNING_APP_SCOPE),
      tokenProfileId
        ? this.getRoleNames(tokenProfileId, GLOBAL_APP_SCOPE)
        : Promise.resolve(new Set<string>()),
      offeringId ? this.getOwnership(offeringId) : Promise.resolve(undefined),
    ]);

    return authorizeOfferingAction(
      learningProfileId,
      action,
      {
        isPlatformOwner: [...globalRoleNames].some((name) =>
          PLATFORM_OWNER_ROLE_NAMES.has(name)
        ),
        isLearningAdmin: learningRoleNames.has(LEARNING_ADMIN_ROLE),
        isCourseDesigner: learningRoleNames.has(LEARNING_COURSE_DESIGNER_ROLE),
      },
      ownership
    );
  }

  /**
   * Whether this caller sees every draft in the catalog, not just their own.
   *
   * The same two roles that may act on any offering may also read any
   * unpublished one. Nothing else grants it, including the course-designer
   * role: writing a course does not entitle you to read someone else's.
   */
  async seesEveryDraft(
    learningProfileId: string,
    tokenProfileId: string | undefined
  ): Promise<boolean> {
    const [learningRoleNames, globalRoleNames] = await Promise.all([
      this.getRoleNames(learningProfileId, LEARNING_APP_SCOPE),
      tokenProfileId
        ? this.getRoleNames(tokenProfileId, GLOBAL_APP_SCOPE)
        : Promise.resolve(new Set<string>()),
    ]);
    return (
      learningRoleNames.has(LEARNING_ADMIN_ROLE) ||
      [...globalRoleNames].some((name) => PLATFORM_OWNER_ROLE_NAMES.has(name))
    );
  }

  async getOwnership(
    offeringId: string
  ): Promise<OfferingOwnership | undefined> {
    return (await firstValueFrom(
      this.learningService.send(
        { cmd: LearningCommands.GetOfferingOwnership },
        { offeringId }
      )
    )) as OfferingOwnership | undefined;
  }

  private async getRoleNames(
    profileId: string,
    appScope: string
  ): Promise<Set<string>> {
    try {
      const roles = (await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetUserRoles },
          { profileId, appScope }
        )
      )) as Array<{ role?: { name?: string } }>;
      return new Set(
        (roles ?? [])
          .map((assignment) => assignment.role?.name)
          .filter((name): name is string => Boolean(name))
      );
    } catch (error) {
      // A caller with no readable roles is not privileged. Failing closed
      // here means a permissions-service hiccup denies an authoring action
      // rather than silently granting one.
      this.logger.warn(
        `Failed to read roles for profile ${profileId} in scope ${appScope}: ${
          (error as Error)?.message
        }`
      );
      return new Set();
    }
  }
}
