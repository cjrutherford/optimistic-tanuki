import { LeadAuthContext } from './lead-auth-context.interface';

export type HardwareProposalTier = 'tier1' | 'tier2' | 'tier3';

/** Context constructed by Gateway after verifying the Owner Console owner role. */
export interface VerifiedHardwareProposalOwnerContext extends LeadAuthContext {
  appScope: 'owner-console';
  ownerConsoleAccess: true;
}

export interface CommitHardwareProposalRequest {
  context: VerifiedHardwareProposalOwnerContext;
  proposal: {
    quoteId: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    tier: HardwareProposalTier;
    total: number;
    currency: string;
    /** Customer-safe terms only; wholesale costs and margin data are excluded. */
    terms: Record<string, unknown>;
    idempotencyKey: string;
  };
}
