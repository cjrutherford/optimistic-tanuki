import { Inject, Injectable, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { OAuthProviderEntity } from '../oauth-providers/entities/oauth-provider.entity';
import { UserEntity } from '../user/entities/user.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { OAuthConfigValidator } from './oauth-config.validator';

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
    private readonly configValidator: OAuthConfigValidator
  ) {}

  async oauthLogin(
    provider: string,
    providerUserId: string,
    email: string,
    displayName: string,
    accessToken?: string,
    refreshToken?: string,
    profileId?: string
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

      this.l.debug(
        `OAuth login attempt: provider=${provider}, providerUserId=${providerUserId}`
      );

      // Find existing linked account
      const linked = await this.oauthRepo.findOne({
        where: { provider, providerUserId },
        relations: ['user'],
      });

      if (linked && linked.user) {
        // Update tokens if provided
        if (accessToken) linked.accessToken = accessToken;
        if (refreshToken) linked.refreshToken = refreshToken;
        await this.oauthRepo.save(linked);

        // Issue JWT for the linked user
        return await this.issueTokenForUser(linked.user, profileId);
      }

      // Try to find user by email and auto-link
      if (email) {
        const existingUser = await this.userRepo.findOne({
          where: { email: email.toLowerCase() },
        });

        if (existingUser) {
          // Auto-link the provider to the existing user
          await this.oauthRepo.save({
            provider,
            providerUserId,
            providerEmail: email,
            providerDisplayName: displayName,
            accessToken,
            refreshToken,
            userId: existingUser.id,
          });

          return await this.issueTokenForUser(existingUser, profileId);
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
    accessToken?: string,
    refreshToken?: string,
    providerEmail?: string,
    providerDisplayName?: string
  ) {
    try {
      this.l.debug(`Linking provider=${provider} to userId=${userId}`);

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new RpcException('User not found');
      }

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
        accessToken,
        refreshToken,
        userId,
      });

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
      this.l.debug(`Unlinking provider=${provider} from userId=${userId}`);

      const linked = await this.oauthRepo.findOne({
        where: { provider, userId },
      });
      if (!linked) {
        throw new RpcException(
          `Provider ${provider} is not linked to this account`
        );
      }

      // Ensure user has at least a password or another provider before unlinking
      const user = await this.userRepo.findOne({ where: { id: userId } });
      const otherProviders = await this.oauthRepo.count({
        where: { userId },
      });

      if (!user.password && otherProviders <= 1) {
        throw new RpcException(
          'Cannot unlink the last authentication provider. Set a password first.'
        );
      }

      await this.oauthRepo.remove(linked);

      return {
        message: `Provider ${provider} unlinked successfully`,
        code: 0,
      };
    } catch (e) {
      this.l.error('Error in unlinkProvider:', e);
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

  private async issueTokenForUser(user: UserEntity, profileId?: string) {
    const pl = {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      profileId: profileId || '',
    };

    const tk = this.jsonWebToken.sign(pl, {
      secret: this.jwtSecret,
      expiresIn: '1h',
    });

    const ntk = {
      tokenData: tk,
      userId: user.id,
      user,
      revoked: false,
    };
    await this.tokenRepo.save(ntk);

    // Return sanitized user data without sensitive fields
    const { password, keyData, ...sanitizedUser } = user;

    return {
      message: 'OAuth login successful',
      code: 0,
      data: { newToken: tk },
    };
  }

  private getProviderDisplayName(provider: string): string {
    const displayNames: Record<string, string> = {
      google: 'Google',
      github: 'GitHub',
      microsoft: 'Microsoft',
      facebook: 'Facebook',
      x: 'Twitter/X',
    };
    return displayNames[provider] || provider;
  }
}
