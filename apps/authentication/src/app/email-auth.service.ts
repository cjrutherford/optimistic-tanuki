import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { EmailService } from '@optimistic-tanuki/email';
import { TokenIssuerService } from '@optimistic-tanuki/auth-domain';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import {
  AuthActionPurpose,
  AuthActionTokenEntity,
} from '../email-auth/entities/auth-action-token.entity';

export interface AuthEmailContext {
  appId: string;
  appName: string;
  uiBaseUrl: string;
  from: string;
  replyTo?: string;
  returnPath?: string;
}

type PasswordTools = {
  ensurePasswordConfirmation(password: string, confirmation: string): void;
  createNewHash(password: string): { hash: string; salt: string | Buffer };
};

@Injectable()
export class EmailAuthService {
  constructor(
    @Inject(getRepositoryToken(UserEntity))
    private readonly users: Repository<UserEntity>,
    @Inject(getRepositoryToken(AuthActionTokenEntity))
    private readonly actions: Repository<AuthActionTokenEntity>,
    @Inject(getRepositoryToken(TokenEntity))
    private readonly sessions: Repository<TokenEntity>,
    private readonly email: EmailService,
    @Inject('EMAIL_PASSWORD_TOOLS')
    private readonly passwordTools: PasswordTools,
    private readonly tokenIssuer: TokenIssuerService
  ) {}

  async requestAction(
    email: string,
    purpose: AuthActionPurpose,
    context: AuthEmailContext
  ): Promise<{ accepted: true; sent: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.users.findOne({
      where: { email: normalizedEmail },
    });
    if (!user) return { accepted: true, sent: false };

    await this.actions.update(
      { userId: user.id, purpose, appId: context.appId, consumedAt: IsNull() },
      { consumedAt: new Date() }
    );

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(rawToken);
    const returnPath = this.safeReturnPath(context.returnPath);
    await this.actions.save({
      tokenHash,
      purpose,
      appId: context.appId,
      returnPath,
      expiresAt: new Date(Date.now() + this.ttlMs(purpose)),
      userId: user.id,
      user,
      consumedAt: null,
    });

    const actionPath = this.actionPath(purpose);
    const actionUrl = `${context.uiBaseUrl.replace(
      /\/$/,
      ''
    )}${actionPath}#token=${encodeURIComponent(rawToken)}`;
    const label = this.actionLabel(purpose);
    const result = await this.email.sendEmail({
      to: user.email,
      from: context.from,
      replyTo: context.replyTo,
      subject: `${label} — ${context.appName}`,
      text: `${label} for ${context.appName}: ${actionUrl}`,
      html: `<h1>${this.escape(
        context.appName
      )}</h1><p>${label}</p><p><a href="${actionUrl}">Continue securely</a></p><p>If you did not request this, you can ignore this message.</p>`,
    });
    if (!result.success) {
      await this.actions.update({ tokenHash }, { consumedAt: new Date() });
    }
    return { accepted: true, sent: result.success };
  }

  async inspect(rawToken: string, purpose: AuthActionPurpose) {
    const action = await this.actions.findOne({
      where: { tokenHash: this.hash(rawToken), purpose },
      relations: ['user', 'user.keyData'],
    });
    if (!action || action.consumedAt) {
      throw new RpcException({ code: 'ACTION_TOKEN_INVALID' });
    }
    if (action.expiresAt.getTime() <= Date.now()) {
      throw new RpcException({ code: 'ACTION_TOKEN_EXPIRED' });
    }
    return action;
  }

  async consumeLoginAction(
    rawToken: string,
    purpose: AuthActionPurpose.Verification | AuthActionPurpose.MagicLink,
    profileId?: string
  ) {
    const action = await this.inspect(rawToken, purpose);
    const consumed = await this.actions.update(
      { id: action.id, consumedAt: IsNull() },
      { consumedAt: new Date() }
    );
    if (!consumed.affected) {
      throw new RpcException({ code: 'ACTION_TOKEN_USED' });
    }
    action.user.emailVerifiedAt ||= new Date();
    await this.users.save(action.user);
    const session = this.tokenIssuer.issueForUser(
      {
        userId: action.user.id,
        firstName: action.user.firstName,
        lastName: action.user.lastName,
        email: action.user.email,
      },
      profileId
    );
    await this.sessions.save({
      tokenData: session,
      userId: action.user.id,
      user: action.user,
      revoked: false,
      profileId: profileId || null,
    } as any);
    return {
      message: 'Authentication successful',
      code: 0,
      appId: action.appId,
      returnPath: action.returnPath,
      data: { newToken: session },
    };
  }

  async resetPassword(
    rawToken: string,
    password: string,
    confirmation: string
  ) {
    this.passwordTools.ensurePasswordConfirmation(password, confirmation);
    const action = await this.inspect(
      rawToken,
      AuthActionPurpose.PasswordReset
    );
    const consumed = await this.actions.update(
      { id: action.id, consumedAt: IsNull() },
      { consumedAt: new Date() }
    );
    if (!consumed.affected)
      throw new RpcException({ code: 'ACTION_TOKEN_USED' });
    const next = this.passwordTools.createNewHash(password);
    if (!action.user.keyData) throw new RpcException('User not found');
    action.user.password = next.hash;
    action.user.keyData.salt = next.salt.toString();
    await this.users.save(action.user);
    await this.sessions.update(
      { userId: action.user.id, revoked: false },
      { revoked: true }
    );
    return { message: 'Password reset successful', code: 0 };
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlMs(purpose: AuthActionPurpose) {
    if (purpose === AuthActionPurpose.MagicLink) return 15 * 60_000;
    if (purpose === AuthActionPurpose.PasswordReset) return 30 * 60_000;
    return 24 * 60 * 60_000;
  }

  private actionPath(purpose: AuthActionPurpose) {
    if (purpose === AuthActionPurpose.MagicLink) return '/auth/magic-link';
    if (purpose === AuthActionPurpose.PasswordReset)
      return '/auth/reset-password';
    return '/auth/verify';
  }

  private actionLabel(purpose: AuthActionPurpose) {
    if (purpose === AuthActionPurpose.MagicLink)
      return 'Sign in with your magic link';
    if (purpose === AuthActionPurpose.PasswordReset)
      return 'Reset your password';
    return 'Verify your email address';
  }

  private safeReturnPath(path = '/') {
    return path.startsWith('/') && !path.startsWith('//') ? path : '/';
  }

  private escape(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        }[character] as string)
    );
  }
}
