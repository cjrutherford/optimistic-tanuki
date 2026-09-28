export interface LeadAuthContext {
  userId: string;
  profileId: string;
  appScope: string;
  /** Set only by Gateway after exact Owner Console role verification. */
  ownerConsoleAccess?: boolean;
}
