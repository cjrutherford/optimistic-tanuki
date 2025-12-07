export interface UserContext {
  userId: string;
  email: string;
  name: string;
  profileId: string;
  scopes?: string[];
  roles?: string[];
}