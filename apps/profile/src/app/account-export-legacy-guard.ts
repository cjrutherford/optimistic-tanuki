/**
 * The original Profile migration retains goal/project stores and timeline links
 * absent from today's entity metadata. Do not silently certify those accounts.
 * Run through the capture's bounded query function in its read-only snapshot.
 */
export async function assertNoUncoveredProfileLegacyData(
  accountId: string,
  query: (sql: string, parameters: unknown[]) => Promise<unknown>
): Promise<void> {
  const rows = await query(
    `SELECT
       EXISTS(SELECT 1 FROM "goal" WHERE "userId" = $1) AS "ownedGoal",
       EXISTS(SELECT 1 FROM "project" WHERE "userId" = $1) AS "ownedProject",
       EXISTS(SELECT 1 FROM "timeline" WHERE "userId" = $1
         AND ("relatedGoalId" IS NOT NULL OR "relatedProjectId" IS NOT NULL)) AS "legacyTimelineLink"`,
    [accountId]
  );
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('PROFILE_OWNER_LEGACY_INVENTORY_UNAVAILABLE');
  }
  const row: unknown = rows[0];
  if (!row || typeof row !== 'object') {
    throw new Error('PROFILE_OWNER_LEGACY_INVENTORY_UNAVAILABLE');
  }
  for (const field of ['ownedGoal', 'ownedProject', 'legacyTimelineLink']) {
    const value = (row as Record<string, unknown>)[field];
    if (typeof value !== 'boolean') {
      throw new Error('PROFILE_OWNER_LEGACY_INVENTORY_UNAVAILABLE');
    }
    if (value) throw new Error('PROFILE_OWNER_LEGACY_DATA_UNCOVERED');
  }
}
