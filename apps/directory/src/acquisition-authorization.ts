/**
 * Which providers the owner has authorised for acquisition. Owner decision D1 (2026-11-18): Overture, run
 * automatically by the directory worker; D3: the standalone AllThePlaces archive (CC0-1.0). Every other provider
 * stays unauthorised and keeps the console's blocked / unauthorised behaviour. Authorisation is not a bypass: the
 * rights policy, the budget ledger and the `provider_acquisition` kill switch still gate every attempt.
 */
export const ACQUISITION_AUTHORIZED_PROVIDERS: Readonly<
  Record<string, boolean>
> = Object.freeze({ overture: true, alltheplaces: true });

/**
 * Providers authorised for private enrichment of an already-staged listing, never for acquisition (owner decision
 * D4). Geoapify results are not displayable or exportable: `export-job.ts` and `public-export.ts` deny them.
 */
export const PRIVATE_ENRICHMENT_PROVIDERS: Readonly<Record<string, boolean>> =
  Object.freeze({ geoapify: true });

export function isPrivateEnrichmentAuthorized(provider: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    PRIVATE_ENRICHMENT_PROVIDERS,
    provider
  )
    ? PRIVATE_ENRICHMENT_PROVIDERS[provider] === true
    : false;
}

export interface ProviderAuthorizationRow {
  provider: string;
  acquisition: boolean;
  privateEnrichment: boolean;
  /** Public display and public export are never granted by this module. Enrichment-only providers stay denied. */
  publicDisplayAndExport: boolean;
  scope: 'acquisition' | 'private-enrichment-only';
}

/** The authorisation table as the console and the evidence report it. */
export function providerAuthorizationTable(): ProviderAuthorizationRow[] {
  const acquisition = Object.keys(ACQUISITION_AUTHORIZED_PROVIDERS).sort();
  const enrichment = Object.keys(PRIVATE_ENRICHMENT_PROVIDERS).sort();
  return [
    ...acquisition.map((provider) => ({
      provider,
      acquisition: isAcquisitionAuthorized(provider),
      privateEnrichment: false,
      publicDisplayAndExport: false,
      scope: 'acquisition' as const,
    })),
    ...enrichment.map((provider) => ({
      provider,
      acquisition: isAcquisitionAuthorized(provider),
      privateEnrichment: isPrivateEnrichmentAuthorized(provider),
      publicDisplayAndExport: false,
      scope: 'private-enrichment-only' as const,
    })),
  ];
}

export function isAcquisitionAuthorized(provider: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    ACQUISITION_AUTHORIZED_PROVIDERS,
    provider
  )
    ? ACQUISITION_AUTHORIZED_PROVIDERS[provider] === true
    : false;
}

/** True when at least one provider is authorised (what the console's budget panel shows). */
export function anyAcquisitionAuthorized(): boolean {
  return Object.values(ACQUISITION_AUTHORIZED_PROVIDERS).some(
    (v) => v === true
  );
}

/** Thrown for an unauthorised provider; `classifyStageError` maps the message to `acquisition_unauthorized`. */
export function assertAcquisitionAuthorized(provider: string): void {
  if (!isAcquisitionAuthorized(provider))
    throw Error(`Acquisition is not enabled for provider ${provider}`);
}
