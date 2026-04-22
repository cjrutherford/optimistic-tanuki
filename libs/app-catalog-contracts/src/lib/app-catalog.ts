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

export function validateCatalogEntries(
  entries: DeveloperCatalogEntry[],
): DeveloperCatalogEntry[] {
  const names = new Set<string>();

  return entries.map((entry) => {
    if (names.has(entry.name)) {
      throw new Error(`Duplicate developer catalog entry: ${entry.name}`);
    }

    names.add(entry.name);

    if (
      entry.deploymentMode === 'app-service' &&
      !entry.billingEligibility.some((eligibility) => eligibility !== 'none')
    ) {
      throw new Error(
        `${entry.name} app-service entries must declare billable eligibility`,
      );
    }

    return createCatalogEntry(entry);
  });
}
