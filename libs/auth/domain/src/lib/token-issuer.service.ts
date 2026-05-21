export type AuthTokenUser = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type AuthTokenPayload = {
  userId: string;
  name: string;
  email: string;
  profileId: string;
};

export type AuthTokenExpiry = '1h';

export type TokenSigner = {
  sign(
    payload: AuthTokenPayload,
    options: { secret: string; expiresIn: AuthTokenExpiry },
  ): string;
};

export class TokenIssuerService {
  constructor(
    private readonly signer: TokenSigner,
    private readonly secret: string,
    private readonly expiresIn: AuthTokenExpiry = '1h',
  ) {}

  issueForUser(user: AuthTokenUser, profileId?: string): string {
    return this.signer.sign(
      {
        userId: user.userId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        profileId: profileId ?? '',
      },
      {
        secret: this.secret,
        expiresIn: this.expiresIn,
      },
    );
  }
}
