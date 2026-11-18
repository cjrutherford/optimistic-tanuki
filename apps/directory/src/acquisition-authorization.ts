/**
 * Which providers the owner has authorised for acquisition. Owner decision D1 (2026-11-18): Overture only, run
 * automatically by the directory worker. Every other provider stays unauthorised and keeps the console's blocked /
 * unauthorised behaviour. Authorisation is not a bypass: the rights policy, the budget ledger and the
 * `provider_acquisition` kill switch still gate every attempt.
 */
export const ACQUISITION_AUTHORIZED_PROVIDERS: Readonly<
  Record<string, boolean>
> = Object.freeze({ overture: true });

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
