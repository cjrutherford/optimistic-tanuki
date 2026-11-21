type Queryable = { query(sql: string, params?: unknown[]): Promise<any[]> };
type SourceRow = { scanId: string; row: string };
type IdentifiedRow = SourceRow & { id: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const validRow = (x: SourceRow) =>
  !!x &&
  /^[a-f0-9]{64}$/.test(x.scanId) &&
  /^(0|[1-9][0-9]{0,15})$/.test(x.row) &&
  Number.isSafeInteger(Number(x.row));

/** Identities bind exact source rows, not inferred businesses or ownership. */
export async function getOrCreateListingIdentities(
  db: Queryable,
  town: string,
  rows: SourceRow[]
): Promise<IdentifiedRow[]> {
  if (
    !uuid.test(town) ||
    !Array.isArray(rows) ||
    rows.length > 5000 ||
    !rows.every(validRow) ||
    new Set(rows.map((x) => `${x.scanId}:${x.row}`)).size !== rows.length
  )
    throw Error('Invalid listing identity');
  if (!rows.length) return [];
  const result = await db.query(
    `INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") SELECT $1,u.scan,u.row FROM unnest($2::varchar[],$3::bigint[]) AS u(scan,row) ORDER BY u.scan,u.row ON CONFLICT ("communityId","scanId","sourceFileRowNumber") DO UPDATE SET "scanId"=EXCLUDED."scanId" RETURNING id,"scanId","sourceFileRowNumber"`,
    [town, rows.map((x) => x.scanId), rows.map((x) => x.row)]
  );
  if (!Array.isArray(result) || result.length !== rows.length)
    throw Error('Invalid listing identity');
  const mapped = result.map((x) => ({
    id: x.id,
    scanId: x.scanId,
    row: String(x.sourceFileRowNumber),
  }));
  const expected = new Set(rows.map((x) => `${x.scanId}:${x.row}`));
  if (
    mapped.some(
      (x) =>
        !uuid.test(x.id) ||
        !validRow(x) ||
        !expected.delete(`${x.scanId}:${x.row}`)
    ) ||
    expected.size
  )
    throw Error('Invalid listing identity');
  return mapped;
}
export async function findListingIdentity(
  db: Queryable,
  town: string,
  id: string
): Promise<SourceRow | null> {
  if (!uuid.test(town) || !uuid.test(id))
    throw Error('Invalid listing identity');
  const rows = await db.query(
    'SELECT "scanId","sourceFileRowNumber" FROM directory_listing_identity WHERE "communityId"=$1 AND id=$2',
    [town, id]
  );
  if (!Array.isArray(rows) || rows.length > 1)
    throw Error('Invalid listing identity');
  if (!rows.length) return null;
  const row = {
    scanId: rows[0].scanId,
    row: String(rows[0].sourceFileRowNumber),
  };
  if (!validRow(row)) throw Error('Invalid listing identity');
  return row;
}
