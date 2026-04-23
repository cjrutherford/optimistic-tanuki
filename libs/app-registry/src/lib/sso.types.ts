export interface TokenValidationResponse {
  valid: boolean;
  userId?: string;
  profileId?: string;
  expiresAt?: string;
}

export interface ExchangedToken {
  token: string;
  targetAppId: string;
  profileId?: string;
  expiresAt?: string;
}
