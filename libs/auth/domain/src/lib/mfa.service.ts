type TotpLike = {
  check(token: string, secret: string): boolean;
};

export class MfaService {
  constructor(private readonly totp: TotpLike) {}

  assertLoginToken(secret: string | null | undefined, token?: string) {
    if (!secret) {
      return;
    }

    if (token === undefined) {
      throw new Error('MFA token is required for this user.');
    }

    if (!this.totp.check(token, secret)) {
      throw new Error('Invalid MFA token');
    }
  }

  validateToken(secret: string | null | undefined, token: string) {
    if (!secret) {
      throw new Error('User not found or TOTP not set up');
    }

    if (!this.totp.check(token, secret)) {
      throw new Error('Invalid TOTP token');
    }
  }
}
