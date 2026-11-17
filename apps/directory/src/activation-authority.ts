/** Legacy checkpoints are not evidence of an enabled six-field activation. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const generation = /^[1-9][0-9]*$/;
export function isEnabledDirectoryAuthority(row: any): boolean {
  return !!row && row.phase === 'enabled' && row.cursor === null &&
    [row.activationId, row.owner, row.sourceEpoch, row.recoveryEpoch].every(value => typeof value === 'string' && uuid.test(value)) &&
    [row.socialGeneration, row.directoryGeneration].every(value => typeof value === 'string' && generation.test(value));
}
