import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  FindManyOptions,
  FindOneOptions,
  ILike,
  In,
  IsNull,
  LessThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Profile, BlogRole } from '../profiles/entities/profile.entity';
import { CreateProfileDto } from '../profiles/dto/create-profile.dto';
import {
  UpdateProfileDto,
  updateProfileDtoToPartial,
} from '../profiles/dto/update-profile.dto';
import { SetBlogRoleDto } from '../profiles/dto/set-blog-role.dto';
import {
  AuthCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  GuardianProfileFields,
  GuardianProfileRequestDto,
  AccountProfileOwnershipRequest,
  AccountProfileOwnershipResult,
} from '@optimistic-tanuki/profile-contracts';
import { GuardianProfileActivity } from '../profiles/entities/guardian-profile-activity.entity';
import { emitSafeDiagnostic } from '@optimistic-tanuki/logger';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UserRoleDto {
  id: string;
  profileId: string;
  targetId?: string;
  roleId: string;
  appScopeId: string;
}

interface AssignRoleDto {
  roleId: string;
  profileId: string;
  appScopeId: string;
}

@Injectable()
export class ProfileService {
  constructor(
    @Inject(getRepositoryToken(Profile))
    private readonly profileRepository: Repository<Profile>,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    private readonly logger: Logger
  ) {}

  async checkAccountProfileOwnership(
    request: AccountProfileOwnershipRequest
  ): Promise<AccountProfileOwnershipResult> {
    if (
      !request ||
      typeof request.accountId !== 'string' ||
      typeof request.profileId !== 'string' ||
      !UUID_PATTERN.test(request.accountId) ||
      !UUID_PATTERN.test(request.profileId)
    ) {
      throw new RpcException({
        code: 'PROFILE_OWNERSHIP_REQUEST_INVALID',
        message: 'Invalid account profile ownership request',
      });
    }
    const accountId = request.accountId.toLowerCase();
    const profileId = request.profileId.toLowerCase();
    const owned = await this.profileRepository
      .createQueryBuilder('profile')
      .select('profile.id')
      .where('profile.id = :profileId', { profileId })
      .andWhere('LOWER(profile.userId) = :accountId', { accountId })
      .getExists();
    return { accountId, profileId, owned };
  }

  async resolveAccountBindings(request: { profileIds: string[] }) {
    const ids = request?.profileIds;
    if (
      !Array.isArray(ids) ||
      ids.length > 100 ||
      ids.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid profile bindings request',
      });
    }
    const profileIds = [...new Set(ids.map((id) => id.toLowerCase()))];
    if (!profileIds.length) return { profileIds, bindings: [] };
    const rows = await this.profileRepository
      .createQueryBuilder('profile')
      .select(['profile.id', 'profile.userId'])
      .where('profile.id IN (:...profileIds)', { profileIds })
      .limit(100)
      .getMany();
    const bindings = rows.flatMap((row) =>
      typeof row.userId === 'string' && UUID_PATTERN.test(row.userId)
        ? [
            {
              profileId: row.id.toLowerCase(),
              accountId: row.userId.toLowerCase(),
            },
          ]
        : []
    );
    return { profileIds, bindings };
  }

  async getGuardianProfile(
    request: GuardianProfileRequestDto
  ): Promise<Profile> {
    this.validateGuardianRequest(request, 'profile.view');
    const initial = await this.profileRepository.findOne({
      where: { id: request.profileId },
    });
    this.assertDependentProfileScope(initial, request.appId);
    await this.authorizeGuardian(request, initial.userId);
    const current = await this.profileRepository.findOne({
      where: { id: request.profileId },
    });
    this.assertUnchangedDependentProfile(initial, current, request.appId);
    await this.profileRepository.manager.transaction(async (manager) => {
      await manager.getRepository(GuardianProfileActivity).save({
        actorUserId: request.actorUserId,
        dependentUserId: initial.userId,
        profileId: initial.id,
        appId: request.appId,
        operation: 'profile.view',
        changedFieldNames: [],
      });
    });
    return current;
  }

  async updateGuardianProfile(
    request: GuardianProfileRequestDto
  ): Promise<Profile> {
    this.validateGuardianRequest(request, 'profile.manage');
    const updates = this.sanitizeGuardianUpdates(request.updates);
    const initial = await this.profileRepository.findOne({
      where: { id: request.profileId },
    });
    this.assertDependentProfileScope(initial, request.appId);
    await this.authorizeGuardian(request, initial.userId);
    return this.profileRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Profile);
      const current = await repository.findOne({
        where: { id: request.profileId },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertUnchangedDependentProfile(initial, current, request.appId);
      await this.authorizeGuardian(request, current.userId);
      const partial = updateProfileDtoToPartial({
        id: current.id,
        ...updates,
      } as UpdateProfileDto);
      const fieldNames = Object.keys(updates).filter((field) => {
        const column = field === 'name' ? 'profileName' : field;
        return (
          current[column as keyof Profile] !== partial[column as keyof Profile]
        );
      });
      if (fieldNames.length) await repository.update(current.id, partial);
      await manager.getRepository(GuardianProfileActivity).save({
        actorUserId: request.actorUserId,
        dependentUserId: current.userId,
        profileId: current.id,
        appId: request.appId,
        operation: 'profile.manage',
        changedFieldNames: fieldNames,
      });
      return repository.findOne({ where: { id: current.id } });
    });
  }

  async purgeGuardianActivity(now = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    await this.profileRepository.manager.delete(GuardianProfileActivity, {
      createdAt: LessThanOrEqual(cutoff),
    });
  }

  private validateGuardianRequest(
    request: GuardianProfileRequestDto,
    operation: GuardianProfileRequestDto['operation']
  ): void {
    if (
      !request?.actorUserId ||
      !request.profileId ||
      !['client-interface', 'local-hub'].includes(request.appId) ||
      request.operation !== operation
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'Guardian profile access denied',
      });
    }
  }

  private sanitizeGuardianUpdates(
    updates: GuardianProfileRequestDto['updates']
  ): Record<string, string> {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid guardian profile update',
      });
    }
    const allowed = new Set<string>(GuardianProfileFields);
    const entries = Object.entries(updates);
    if (
      entries.some(
        ([key, value]) =>
          !allowed.has(key) || (value !== null && typeof value !== 'string')
      )
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid guardian profile update',
      });
    }
    return Object.fromEntries(
      entries.filter((entry): entry is [string, string] => entry[1] !== null)
    );
  }

  private async authorizeGuardian(
    request: GuardianProfileRequestDto,
    dependentUserId: string
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.AuthorizeGuardianProfileOperation },
          {
            actorUserId: request.actorUserId,
            dependentUserId,
            appId: request.appId,
            operation: request.operation,
          }
        )
      );
    } catch (error) {
      const details =
        typeof (error as any)?.getError === 'function'
          ? (error as any).getError()
          : error;
      if (
        details?.code === 'GUARDIAN_PROFILE_ACCESS_DENIED' ||
        details?.statusCode === 403
      ) {
        throw new RpcException({
          statusCode: 403,
          message: 'Guardian profile access denied',
        });
      }
      throw error;
    }
  }

  private assertDependentProfileScope(
    profile: Profile | null,
    appId: string
  ): asserts profile is Profile {
    if (!profile || profile.appScope !== appId) {
      throw new RpcException({
        statusCode: 403,
        message: 'Guardian profile access denied',
      });
    }
  }

  private assertUnchangedDependentProfile(
    initial: Profile,
    current: Profile | null,
    appId: string
  ): asserts current is Profile {
    if (
      !current ||
      current.userId !== initial.userId ||
      current.appScope !== appId
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'Guardian profile access denied',
      });
    }
  }

  async findAll(query?: FindManyOptions<Profile>): Promise<Profile[]> {
    return await this.profileRepository.find(query || {});
  }

  async searchProfiles(params: {
    query?: string;
    excludeIds?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Profile[]> {
    const { query, excludeIds, limit, offset } = params;
    const take = Math.min(limit || DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
    const skip = offset || 0;

    const idFilter =
      excludeIds && excludeIds.length > 0 ? { id: Not(In(excludeIds)) } : {};

    const where = query
      ? [
          { ...idFilter, profileName: ILike(`%${query}%`) },
          { ...idFilter, bio: ILike(`%${query}%`) },
        ]
      : { ...idFilter };

    return await this.profileRepository.find({
      where,
      order: { profileName: 'ASC' },
      take,
      skip,
    });
  }

  async findOne(id: string, query?: FindOneOptions<Profile>): Promise<Profile> {
    return await this.profileRepository.findOne({ where: { id }, ...query });
  }

  async findByUserId(userId: string): Promise<Profile> {
    return await this.profileRepository.findOne({ where: { userId } });
  }

  async findByUserIdAndAppScope(
    userId: string,
    appScope: string
  ): Promise<Profile> {
    const normalizedScope = this.normalizeScope(appScope);
    const profile = await this.profileRepository.findOne({
      where: this.buildScopeWhere(userId, normalizedScope),
    });
    emitSafeDiagnostic(
      this.logger,
      'profile.operation',
      { outcome: profile ? 'ok' : 'unavailable' },
      'debug'
    );
    return profile;
  }

  async getGuardianConsoleProfile(userId: string, appScope: string) {
    const profile = await this.profileRepository.findOne({
      where: this.buildScopeWhere(userId, this.normalizeScope(appScope)),
    });
    if (!profile) return null;
    return {
      id: profile.id,
      userId: profile.userId,
      appScope: profile.appScope,
      profileName: profile.profileName,
      profilePic: profile.profilePic || '',
      coverPic: profile.coverPic || '',
    };
  }

  async create(
    profile: CreateProfileDto & {
      appScope?: string;
      copyPermissionsFromGlobalProfile?: boolean;
    }
  ): Promise<Profile> {
    const normalizedScope = this.normalizeScope(profile.appScope);
    // Check if a profile already exists for this user+appScope to prevent duplicates
    const existingProfile = await this.findByUserIdAndAppScope(
      profile.userId,
      normalizedScope
    );
    if (existingProfile) {
      emitSafeDiagnostic(
        this.logger,
        'profile.operation',
        { outcome: 'ok' },
        'warn'
      );
      return existingProfile;
    }

    const newProfile: Partial<Profile> = {
      userId: profile.userId,
      appScope: normalizedScope,
      profileName: profile.name,
      profilePic: profile.profilePic,
      coverPic: profile.coverPic,
      bio: profile.bio,
      // The profile editor treats these fields as optional, while their
      // database columns are non-nullable. Normalize omitted values at the
      // persistence boundary instead of inserting SQL NULL.
      location: profile.location ?? '',
      occupation: profile.occupation ?? '',
      interests: profile.interests ?? '',
      skills: profile.skills ?? '',
    };
    let savedProfile: Profile;
    try {
      savedProfile = await this.profileRepository.save(newProfile);
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const recoveredProfile = await this.findByUserIdAndAppScope(
        profile.userId,
        normalizedScope
      );
      if (recoveredProfile) {
        emitSafeDiagnostic(
          this.logger,
          'profile.operation',
          { outcome: 'ok' },
          'warn'
        );
        return recoveredProfile;
      }

      throw error;
    }

    // If this is an app-scoped profile, copy permissions from the global profile
    if (
      normalizedScope !== 'global' &&
      profile.copyPermissionsFromGlobalProfile !== false
    ) {
      await this.copyPermissionsFromGlobalProfile(
        profile.userId,
        savedProfile.id
      );
    }

    return savedProfile;
  }

  /**
   * Copies permissions (role assignments) from the user's global profile to a new app-scoped profile.
   * This ensures users retain their permissions when creating app-specific profiles.
   * @param userId The user ID to find the global profile for
   * @param targetProfileId The new app-scoped profile to copy permissions to
   */
  private async copyPermissionsFromGlobalProfile(
    userId: string,
    targetProfileId: string
  ): Promise<void> {
    try {
      // Find the global profile for this user
      const globalProfile = await this.profileRepository.findOne({
        where: this.buildScopeWhere(userId, 'global'),
      });

      if (!globalProfile) {
        emitSafeDiagnostic(
          this.logger,
          'profile.operation',
          { outcome: 'unavailable' },
          'debug'
        );
        return;
      }

      await this.copyPermissionsBetweenProfiles(
        globalProfile.id,
        targetProfileId
      );
    } catch (error) {
      emitSafeDiagnostic(
        this.logger,
        'profile.operation',
        { outcome: 'failed' },
        'error'
      );
      // Don't throw - permission copying failure shouldn't prevent profile creation
    }
  }

  /**
   * Copies all role assignments from one profile to another.
   * @param sourceProfileId The profile to copy permissions from
   * @param targetProfileId The profile to copy permissions to
   */
  private async copyPermissionsBetweenProfiles(
    sourceProfileId: string,
    targetProfileId: string
  ): Promise<void> {
    try {
      // Get the roles assigned to the source profile
      const userRoles = await firstValueFrom(
        this.permissionsClient.send<UserRoleDto[]>(
          { cmd: RoleCommands.GetUserRoles },
          { profileId: sourceProfileId }
        )
      );

      if (!userRoles || userRoles.length === 0) {
        emitSafeDiagnostic(
          this.logger,
          'profile.operation',
          { outcome: 'unavailable', count: 0 },
          'debug'
        );
        return;
      }

      emitSafeDiagnostic(
        this.logger,
        'profile.operation',
        { outcome: 'ok', count: userRoles.length },
        'log'
      );

      // Assign each role to the target profile
      for (const userRole of userRoles) {
        const assignRoleDto: AssignRoleDto = {
          roleId: userRole.roleId,
          profileId: targetProfileId,
          appScopeId: userRole.appScopeId,
        };

        try {
          await firstValueFrom(
            this.permissionsClient.send(
              { cmd: RoleCommands.Assign },
              assignRoleDto
            )
          );
          emitSafeDiagnostic(
            this.logger,
            'profile.operation',
            { outcome: 'ok' },
            'debug'
          );
        } catch (roleError) {
          emitSafeDiagnostic(
            this.logger,
            'profile.operation',
            { outcome: 'failed' },
            'warn'
          );
          // Continue with other roles even if one fails
        }
      }

      emitSafeDiagnostic(
        this.logger,
        'profile.operation',
        { outcome: 'ok', count: userRoles.length },
        'log'
      );
    } catch (error) {
      emitSafeDiagnostic(
        this.logger,
        'profile.operation',
        { outcome: 'failed' },
        'error'
      );
    }
  }

  async update(id: string, profile: UpdateProfileDto): Promise<Profile> {
    const partialProfile = updateProfileDtoToPartial(profile);
    await this.profileRepository.update(id, {
      ...partialProfile,
      bio: partialProfile.bio || '',
    });
    return await this.profileRepository.findOne({ where: { id } });
  }

  async setBlogRole(profileId: string, blogRole: BlogRole): Promise<Profile> {
    await this.profileRepository.update(profileId, { blogRole });
    return await this.profileRepository.findOne({ where: { id: profileId } });
  }

  async getBlogRole(userId: string): Promise<BlogRole> {
    const profile = await this.findByUserId(userId);
    return profile?.blogRole || BlogRole.NONE;
  }

  private normalizeScope(appScope?: string | null): string {
    return appScope?.trim() ? appScope.trim() : 'global';
  }

  private buildScopeWhere(userId: string, appScope: string) {
    if (appScope === 'global') {
      return [
        { userId, appScope: 'global' },
        { userId, appScope: IsNull() },
      ];
    }

    return { userId, appScope };
  }

  private isUniqueViolation(error: unknown): error is { code?: string } {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
