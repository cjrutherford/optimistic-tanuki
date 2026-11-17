import { evaluateOvertureFieldRights, OvertureRightsPolicy, OvertureRightsSource } from './overture-rights';

/** Classification must come from an independently reviewed private-pilot workflow. */
type Classification = { residential?: boolean; sensitive?: boolean; adult?: boolean; adultOptIn?: boolean };
type Input = { id?: unknown; releaseId?: string; sources?: readonly OvertureRightsSource[]; names?: { primary?: unknown }; basic_category?: unknown; taxonomy?: { primary?: unknown; hierarchy?: unknown }; geometry?: { type?: unknown; coordinates?: unknown } };
type PrivateListing = { name: string; category: string; location: { type: 'Point'; coordinates: [number, number] }; attribution: string[]; notices: string[]; termsUrls: string[] };
/** `upstreamId` travels beside the listing, never inside it, and only when the policy approves ingest and retain of the id. */
type Projection = { status: 'quarantined' } | { status: 'eligible'; listing: PrivateListing; upstreamId?: string };

/** No persistence or public endpoint. The caller must obtain policy from a trusted approval authority. */
export function projectPrivateOverture(row: Input, classification: Classification | undefined, policy?: OvertureRightsPolicy): Projection {
  const denied: Projection = { status: 'quarantined' };
  if (!row || !classification || !['residential', 'sensitive', 'adult'].every(key => Object.prototype.hasOwnProperty.call(classification, key)) || classification?.residential !== false || classification?.sensitive !== false || (classification?.adult !== false && !(classification?.adult === true && Object.prototype.hasOwnProperty.call(classification, 'adultOptIn') && classification.adultOptIn === true))) return denied;
  const coordinates = row.geometry?.coordinates;
  if (typeof row.names?.primary !== 'string' || !row.names.primary.trim() || typeof row.basic_category !== 'string' || !row.basic_category.trim() || typeof row.taxonomy?.primary !== 'string' || !row.taxonomy.primary.trim() || !Array.isArray(row.taxonomy.hierarchy) || Array.from({length: row.taxonomy.hierarchy.length}, (_, i) => Object.prototype.hasOwnProperty.call(row.taxonomy!.hierarchy, i) && typeof (row.taxonomy!.hierarchy as unknown[])[i] === 'string').some(valid => !valid) || row.geometry?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2 || !Object.prototype.hasOwnProperty.call(coordinates, 0) || !Object.prototype.hasOwnProperty.call(coordinates, 1) || !coordinates.every(value => typeof value === 'number' && Number.isFinite(value)) || coordinates[0] < -180 || coordinates[0] > 180 || coordinates[1] < -90 || coordinates[1] > 90) return denied;
  const decisions = (['ingest', 'retain', 'privateDisplay'] as const).map(operation => evaluateOvertureFieldRights(row, operation, policy));
  if (decisions.some(decision => !decision.eligible)) return denied;
  const attribution = [...new Set(decisions.flatMap(decision => Object.values(decision.fields).flatMap(field => field.attributions)))];
  if (!attribution.length) return denied;
  const notices = [...new Set(decisions.flatMap(decision => Object.values(decision.fields).flatMap(field => field.notices)))];
  const termsUrls = [...new Set(decisions.flatMap(decision => Object.values(decision.fields).flatMap(field => field.termsUrls)))];
  const idApproved = decisions[0].fields['id']?.status === 'eligible' && decisions[1].fields['id']?.status === 'eligible';
  return { status: 'eligible', ...(idApproved && typeof row.id === 'string' ? { upstreamId: row.id } : {}), listing: { name: row.names.primary, category: row.basic_category, location: { type: 'Point', coordinates: [coordinates[0], coordinates[1]] }, attribution, notices, termsUrls } };
}

/** Bridge from the private extractor; neither policy nor classification is inferred from the source row. */
export function createPrivateOvertureProjector(releaseId: string, policy: OvertureRightsPolicy, classify: (source: Input, regionId: string) => Promise<Classification | undefined>) {
  if (!releaseId || policy?.releaseId !== releaseId || typeof classify !== 'function') throw Error('Exact release policy and classifier required');
  const approvedPolicy = structuredClone(policy);
  return async ({source, regionId}: {source: Input; regionId: string}): Promise<Projection> => {
    if (!source || typeof regionId !== 'string' || !regionId) return {status: 'quarantined'};
    const selectedSource = structuredClone(source);
    const classification = await classify(structuredClone(selectedSource), regionId);
    return projectPrivateOverture({...selectedSource, releaseId}, classification, approvedPolicy);
  };
}
