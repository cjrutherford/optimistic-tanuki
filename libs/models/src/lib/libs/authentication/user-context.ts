export interface UserContext {
  userId: string;
  email: string;
  name: string;
  profileId: string;
  emailVerified?: boolean;
  scopes?: string[];
  roles?: string[];
}
