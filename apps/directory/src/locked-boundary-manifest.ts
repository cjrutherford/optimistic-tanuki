/**
 * The locked-boundary manifest installs a Census entity as a town's border. By default the entity has to be the
 * town itself: its Census name is the town's name (the part before the state suffix) or the same name with a
 * descriptor word on one side ("St. Simons" for "St. Simons Island", "Spotsylvania Courthouse" for "Spotsylvania").
 * Installing a differently named
 * entity (a township that is larger than the town, say) is an explicit owner decision, and the manifest entry has to
 * record it. This check is the only place that distinction is made, so the same-name rule is not weakened for any
 * entry that carries no owner decision.
 */
export interface OwnerDecision {
  id: string;
  date: string;
  summary: string;
}
export interface LockedManifestEntryNames {
  townName: string;
  censusName: string;
  ownerDecision?: OwnerDecision;
}

const townBaseName = (townName: string): string =>
  townName.replace(/,\s*[A-Z]{2}$/, '').trim();

function sameName(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

export function assertOwnerApprovalForEntity(
  entry: LockedManifestEntryNames
): void {
  if (sameName(townBaseName(entry.townName), entry.censusName)) {
    if (entry.ownerDecision !== undefined)
      validateOwnerDecision(entry.ownerDecision);
    return;
  }
  if (!entry.ownerDecision)
    throw Error(
      'Census entity name differs from the town and the manifest records no owner decision'
    );
  validateOwnerDecision(entry.ownerDecision);
}

function validateOwnerDecision(decision: OwnerDecision): void {
  if (
    !decision ||
    !/^D[0-9]{1,3}$/.test(decision.id || '') ||
    !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(decision.date || '') ||
    typeof decision.summary !== 'string' ||
    decision.summary.trim().length < 20
  )
    throw Error('Invalid owner decision in the manifest');
}
