import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  FindManyOptions,
  FindOneOptions,
  ILike,
  In,
  IsNull,
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
import { RoleCommands, ServiceTokens } from '@optimistic-tanuki/constants';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 100;

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
    private readonly logger: Logger
  ) {}

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
    this.logger.debug(
      `findByUserIdAndAppScope userId=${userId} appScope=${normalizedScope} => profile=${JSON.stringify(
        profile
      )}`
    );
    return profile;
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
      this.logger.warn(
        `Profile already exists for user ${profile.userId} in scope ${normalizedScope}, returning existing profile`
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
      location: profile.location,
      occupation: profile.occupation,
      interests: profile.interests,
      skills: profile.skills,
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
        this.logger.warn(
          `Recovered existing profile for user ${profile.userId} in scope ${normalizedScope} after unique violation`
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
        this.logger.debug(
          `No global profile found for user ${userId}, skipping permission copy`
        );
        return;
      }

      await this.copyPermissionsBetweenProfiles(
        globalProfile.id,
        targetProfileId
      );
    } catch (error) {
      this.logger.error(
        `Failed to copy permissions from global profile for user ${userId}: ${error.message}`,
        error.stack
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
        this.logger.debug(
          `No roles found on source profile ${sourceProfileId} to copy`
        );
        return;
      }

      this.logger.log(
        `Copying ${userRoles.length} role(s) from profile ${sourceProfileId} to ${targetProfileId}`
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
          this.logger.debug(
            `Assigned role ${userRole.roleId} to profile ${targetProfileId}`
          );
        } catch (roleError) {
          this.logger.warn(
            `Failed to assign role ${userRole.roleId} to profile ${targetProfileId}: ${roleError.message}`
          );
          // Continue with other roles even if one fails
        }
      }

      this.logger.log(
        `Successfully copied ${userRoles.length} role(s) from profile ${sourceProfileId} to ${targetProfileId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to copy permissions between profiles: ${error.message}`,
        error.stack
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
