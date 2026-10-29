import { isRollingSessionApp } from '@optimistic-tanuki/models';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { OAuthProviderEntity } from '../oauth-providers/entities/oauth-provider.entity';
import { UserEntity } from '../user/entities/user.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { OAuthConfigValidator } from './oauth-config.validator';
import { randomUUID } from 'crypto';
import { GuardianPermissionService } from '../guardian-permissions/guardian-permission.service';
import { ProfileOwnershipVerifier } from './profile-ownership-verifier.service';
import { emitSafeDiagnostic } from '@optimistic-tanuki/logger';
import { AccountDeletionFenceService } from '../account-deletion/account-deletion-fence.service';

@Injectable()
export class OAuthService {
  constructor(
    private readonly l: Logger,
    @Inject(getRepositoryToken(OAuthProviderEntity))
    private readonly oauthRepo: Repository<OAuthProviderEntity>,
    @Inject(getRepositoryToken(UserEntity))
    private readonly userRepo: Repository<UserEntity>,
    @Inject(getRepositoryToken(TokenEntity))
    private readonly tokenRepo: Repository<TokenEntity>,
    @Inject('JWT_SECRET') private readonly jwtSecret: string,
    private readonly jsonWebToken: JwtService,
    private readonly configValidator: OAuthConfigValidator,
    private readonly guardianPermissions: GuardianPermissionService,
    private readonly profileOwnershipVerifier: ProfileOwnershipVerifier,
    private readonly accountDeletionFence: AccountDeletionFenceService
  ) {}

  async oauthLogin(
    provider: string,
    providerUserId: string,
    email: string,
    displayName: string,
    profileId?: string,
    emailVerified = false,
    appId?: string,
    ageEligibilityStatus?: 'adult',
    guardianResumeToken?: string
  ) {
    try {
      // Check if the provider is enabled and properly configured
      if (!this.configValidator.isProviderEnabled(provider)) {
        const displayName = this.getProviderDisplayName(provider);
        this.l.warn(
          `OAuth login attempted for disabled/unconfigured provider: ${provider}`
        );
        throw new RpcException(
          `${displayName} OAuth is not enabled. Please contact your administrator to configure OAuth providers. See OAUTH_SETUP.md for setup instructions.`
        );
      }

      this.l.debug(`OAuth login attempt: provider=${provider}`);

      // Find existing linked account
      const linked = await this.oauthRepo.findOne({
        where: { provider, providerUserId },
        relations: ['user'],
      });

      if (linked && linked.user) {
        await this.accountDeletionFence.assertActiveAccount(linked.user.id);
        await this.applyEligibility(
          linked.user,
          appId,
          ageEligibilityStatus,
          guardianResumeToken
        );
        // Issue JWT for the linked user
        return await this.issueTokenForUser(linked.user, profileId, appId);
      }

      // Try to find user by email and auto-link
      if (email) {
        const existingUser = await this.userRepo.findOne({
          where: { email: email.toLowerCase() },
        });

        if (existingUser) {
          await this.accountDeletionFence.assertActiveAccount(existingUser.id);
          // Account-takeover guard: only auto-link when the provider asserts
          // the email is verified. Otherwise an attacker who controls an
          // unverified provider account with a victim's email could seize the
          // existing platform account.
          if (!emailVerified) {
            const providerLabel = this.getProviderDisplayName(provider);
            this.l.warn(
              `Refused OAuth auto-link: provider=${provider} did not verify email for an existing account`
            );
            throw new RpcException(
              `We found an existing account for ${email}, but ${providerLabel} did not confirm you own this email address. Please sign in with your password, then link ${providerLabel} from your account settings.`
            );
          }

          // Evaluate age eligibility before persisting the provider binding.
          // A denied pending/revoked account must not retain a new identity.
          await this.applyEligibility(
            existingUser,
            appId,
            ageEligibilityStatus,
            guardianResumeToken
          );

          // Auto-link the provider to the existing user
          await this.oauthRepo.save({
            provider,
            providerUserId,
            providerEmail: email,
            providerDisplayName: displayName,
            userId: existingUser.id,
          });

          // Audit trail: a verified-email auto-link just occurred.
          this.l.log(
            `OAuth auto-link: linked verified ${provider} identity to an existing account`
          );

          return await this.issueTokenForUser(existingUser, profileId, appId);
        }
      }

      // No existing user found — return info for registration flow
      return {
        message: 'No linked account found',
        code: 1,
        data: {
          provider,
          providerUserId,
          email,
          displayName,
          needsRegistration: true,
        },
      };
    } catch (e) {
      this.l.error('Error in oauthLogin:', e);
      if (e instanceof RpcException) throw e;
      throw new RpcException(e.message || e);
    }
  }

  async linkProvider(
    userId: string,
    provider: string,
    providerUserId: string,
    providerEmail?: string,
    providerDisplayName?: string,
    providerEmailVerified = false
  ) {
    try {
      this.l.debug(`Linking provider=${provider} to userId=${userId}`);

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new RpcException('User not found');
      }
      await this.accountDeletionFence.assertActiveAccount(user.id);

      // Check if this provider is already linked to this user
      const existing = await this.oauthRepo.findOne({
        where: { provider, userId },
      });
      if (existing) {
        throw new RpcException(
          `Provider ${provider} is already linked to this account`
        );
      }

      // Check if this provider account is linked to a different user
      const linkedToOther = await this.oauthRepo.findOne({
        where: { provider, providerUserId },
      });
      if (linkedToOther && linkedToOther.userId !== userId) {
        throw new RpcException(
          `This ${provider} account is already linked to another user`
        );
      }

      const saved = await this.oauthRepo.save({
        provider,
        providerUserId,
        providerEmail,
        providerDisplayName,
        userId,
      });

      // Only the gateway receives the provider's verification claim. Even for
      // that trusted internal path, require an exact email match before a
      // linked identity can establish platform email verification.
      if (
        providerEmailVerified &&
        providerEmail &&
        !user.emailVerifiedAt &&
        user.email.trim().toLowerCase() === providerEmail.trim().toLowerCase()
      ) {
        user.emailVerifiedAt = new Date();
        await this.userRepo.save(user);
      }

      return {
        message: `Provider ${provider} linked successfully`,
        code: 0,
        data: {
          id: saved.id,
          provider: saved.provider,
          providerEmail: saved.providerEmail,
          providerDisplayName: saved.providerDisplayName,
        },
      };
    } catch (e) {
      this.l.error('Error in linkProvider:', e);
      if (e instanceof RpcException) throw e;
      throw new RpcException(e.message || e);
    }
  }

  async unlinkProvider(userId: string, provider: string) {
    try {
      await this.accountDeletionFence.assertActiveAccount(userId);
      await this.oauthRepo.manager.transaction(async (manager) => {
        const users = manager.getRepository(UserEntity);
        const providers = manager.getRepository(OAuthProviderEntity);
        const user = await users.findOne({
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new RpcException('User account not found');

        const linked = await providers.findOne({
          where: { provider, userId },
        });
        if (!linked) {
          throw new RpcException(
            `Provider ${provider} is not linked to this account`
          );
        }

        // The user row lock serializes unlink attempts for this account.
        const otherProviders = await providers.count({ where: { userId } });
        if (!user.password && otherProviders <= 1) {
          throw new RpcException(
            'Cannot unlink the last authentication provider. Set a password first.'
          );
        }

        const linkId = linked.id;
        await providers.remove(linked);
        const remaining = await providers.findOne({
          where: { id: linkId, provider, userId },
          select: ['id'],
        });
        if (remaining) throw new Error('Provider unlink did not complete');
      });

      return {
        message: `Provider ${provider} unlinked successfully`,
        code: 0,
      };
    } catch (e) {
      emitSafeDiagnostic(this.l, 'profile.operation', undefined, 'warn');
      if (e instanceof RpcException) throw e;
      throw new RpcException(e.message || e);
    }
  }

  async getLinkedProviders(userId: string) {
    try {
      this.l.debug(`Getting linked providers for userId=${userId}`);

      const providers = await this.oauthRepo.find({
        where: { userId },
        select: [
          'id',
          'provider',
          'providerEmail',
          'providerDisplayName',
          'createdAt',
        ],
      });

      return {
        message: 'Linked providers retrieved',
        code: 0,
        data: providers,
      };
    } catch (e) {
      this.l.error('Error in getLinkedProviders:', e);
      if (e instanceof RpcException) throw e;
      throw new RpcException(e.message || e);
    }
  }

  private async issueTokenForUser(
    user: UserEntity,
    profileId?: string,
    appId?: string
  ) {
    await this.accountDeletionFence.assertActiveAccount(user.id);
    if (!user.emailVerifiedAt) {
      return {
        message: 'Email verification required',
        code: 2,
        data: {
          userId: user.id,
          email: user.email,
          verificationRequired: true,
        },
      };
    }

    const selectedProfileId =
      await this.profileOwnershipVerifier.resolveSelection(user.id, profileId);

    const pl = {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      profileId: selectedProfileId || '',
      jti: randomUUID(),
      ...(appId ? { appId } : {}),
    };

    const tk = this.jsonWebToken.sign(pl, {
      secret: this.jwtSecret,
      ...(isRollingSessionApp(appId) ? {} : { expiresIn: '1h' as const }),
    });

    const ntk = {
      tokenData: tk,
      userId: user.id,
      user,
      revoked: false,
      profileId: selectedProfileId || null,
    };
    await this.tokenRepo.save(ntk);

    return {
      message: 'OAuth login successful',
      code: 0,
      data: { newToken: tk, userId: user.id },
    };
  }

  private async applyEligibility(
    user: UserEntity,
    appId?: string,
    ageEligibilityStatus?: 'adult',
    guardianResumeToken?: string
  ): Promise<void> {
    if (guardianResumeToken) {
      await this.guardianPermissions.attachAccount(
        guardianResumeToken,
        user.id
      );
      user.ageEligibilityStatus = 'minor';
    } else if (user.ageEligibilityEndsAt) {
      const eligibilityEndsAt = new Date(
        `${user.ageEligibilityEndsAt}T00:00:00.000Z`
      );
      if (eligibilityEndsAt.getTime() <= Date.now()) {
        await this.userRepo.update(user.id, {
          ageEligibilityStatus: 'adult',
          ageEligibilityEndsAt: null,
        });
        user.ageEligibilityStatus = 'adult';
        user.ageEligibilityEndsAt = null;
      } else if (ageEligibilityStatus === 'adult') {
        throw new RpcException({ code: 'AGE_ASSESSMENT_MISMATCH' });
      }
    } else if (
      ageEligibilityStatus === 'adult' &&
      user.ageEligibilityStatus === 'unassessed'
    ) {
      await this.userRepo.update(user.id, {
        ageEligibilityStatus: 'adult',
        ageEligibilityEndsAt: null,
      });
      user.ageEligibilityStatus = 'adult';
    }
    await this.guardianPermissions.assertAccountAccess(user.id, appId);
  }

  private getProviderDisplayName(provider: string): string {
    const displayNames: Record<string, string> = {
      google: 'Google',
      github: 'GitHub',
      microsoft: 'Microsoft',
      facebook: 'Facebook',
    };
    return displayNames[provider] || provider;
  }
}
