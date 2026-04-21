export type DeveloperReleaseChannel = 'alpha' | 'beta' | 'stable';

export type DeveloperDeploymentMode =
  | 'deployable-app'
  | 'internal-lib'
  | 'publishable-lib'
  | 'app-service';

export type BillingEligibility = 'seat' | 'metered' | 'usage-block' | 'none';

export interface DeveloperCatalogEntry {
  name: string;
  ownerDomain: string;
  releaseChannel: DeveloperReleaseChannel;
  deploymentMode: DeveloperDeploymentMode;
  billingEligibility: BillingEligibility[];
}

export function createCatalogEntry(
  entry: DeveloperCatalogEntry,
): DeveloperCatalogEntry {
  return {
    ...entry,
    billingEligibility: [...entry.billingEligibility],
  };
}
