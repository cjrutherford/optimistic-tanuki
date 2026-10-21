/** Internal service lookup used after the caller has established the account. */
export interface AccountProfileOwnershipRequest {
  accountId: string;
  profileId: string;
}

/** Canonical UUID scope echoes bind the answer to the requested selection. */
export interface AccountProfileOwnershipResult {
  accountId: string;
  profileId: string;
  owned: boolean;
}

export interface ResolveAccountBindingsRequest {
  profileIds: string[];
}
export interface ResolveAccountBindingsResult {
  profileIds: string[];
  bindings: Array<{ profileId: string; accountId: string }>;
}
