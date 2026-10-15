export interface UserContext {
  userId: string;
  email: string;
  name: string;
  profileId: string;
  /** Resolved from the signed session and registered request origin by AuthGuard. */
  appId?: string;
  emailVerified?: boolean;
  scopes?: string[];
  roles?: string[];
}
