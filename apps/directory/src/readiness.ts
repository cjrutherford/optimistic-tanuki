export async function checkReadiness(...checks: Array<() => Promise<boolean>>): Promise<boolean> {
  // Wait for every probe to settle, including after a rejection, so a stalled
  // sibling cannot be duplicated by a later readiness request.
  const results = await Promise.allSettled(checks.map((check) => Promise.resolve().then(check)));
  return results.every((result) => result.status === 'fulfilled' && result.value === true);
}
