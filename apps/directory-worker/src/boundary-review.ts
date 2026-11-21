import { DataSource } from 'typeorm';
import { DirectoryRecoveryIdentity } from '../../directory/src/register-recovery-authority';
import { storeBoundaryCandidate } from '../../directory/src/boundary-review';

type Discovery = {
  status: string;
  sourceIdentity: {
    sourceEpoch: string;
    activationId: string;
    socialGeneration: string;
  };
  changeToken: string;
  reviewContext: {
    communityId: string;
    name: string | null;
    city: string | null;
    adminArea: string | null;
    countryCode: string | null;
    localityType: string;
  };
  approximateLocation: { coordinates: [number, number] } | null;
  candidates: Array<{
    geoid: string;
    layer: 'place' | 'cousub';
    vintage: string;
    stateFips: string;
    sourceSha256: string;
  }>;
};
type GeographyReader = {
  geography: (
    identity: {
      sourceEpoch: string;
      activationId: string;
      socialGeneration: string;
    },
    communityId: string
  ) => Promise<{
    status: string;
    changeToken?: string;
    geography?: {
      communityId?: string;
      name?: string | null;
      city?: string | null;
      adminArea?: string | null;
      countryCode?: string | null;
      localityType?: string;
      referencePoint?: [number, number] | null;
    } | null;
  }>;
};

/** Internal preparation only: no reviewer approval or public use is implied. */
export async function storeDiscoveredBoundaryCandidate(
  db: DataSource,
  authority: DirectoryRecoveryIdentity,
  result: Discovery,
  delivery: GeographyReader,
  options?: { automatic?: boolean }
): Promise<void> {
  const identity = {
    sourceEpoch: authority.sourceEpoch,
    activationId: authority.activationId,
    socialGeneration: authority.socialGeneration,
  };
  const discovery = structuredClone(result);
  if (
    !discovery ||
    !discovery.sourceIdentity ||
    Object.keys(identity).some(
      (k) =>
        discovery.sourceIdentity[k as keyof typeof identity] !==
        identity[k as keyof typeof identity]
    )
  )
    throw Error('Source identity mismatch');
  if (
    discovery.status !== 'candidate' ||
    !Array.isArray(discovery.candidates) ||
    discovery.candidates.length !== 1 ||
    !discovery.reviewContext ||
    !discovery.approximateLocation ||
    typeof delivery?.geography !== 'function'
  )
    throw Error('A single review candidate is required');
  const c = discovery.candidates[0];
  await storeBoundaryCandidate(
    db,
    authority,
    {
      communityId: discovery.reviewContext.communityId,
      changeToken: discovery.changeToken,
      geoid: c.geoid,
      layer: c.layer,
      vintage: c.vintage,
      stateFips: c.stateFips,
      archiveSha256: c.sourceSha256,
    },
    async () => {
      const current = await delivery.geography(
          identity,
          discovery.reviewContext.communityId
        ),
        g = current?.geography,
        expected = discovery.reviewContext;
      if (
        !g ||
        g.communityId !== expected.communityId ||
        g.name !== expected.name ||
        g.city !== expected.city ||
        g.adminArea !== expected.adminArea ||
        g.countryCode !== expected.countryCode ||
        g.localityType !== expected.localityType ||
        JSON.stringify(g.referencePoint) !==
          JSON.stringify(discovery.approximateLocation?.coordinates)
      )
        throw Error('Social geography changed');
      return current;
    },
    options
  );
}
