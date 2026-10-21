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
