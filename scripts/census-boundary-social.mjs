import { findCensusBoundaryCandidatesAcross } from './census-boundary-reader.mjs';

const states = Object.freeze({
  AL: '01',
  AK: '02',
  AZ: '04',
  AR: '05',
  CA: '06',
  CO: '08',
  CT: '09',
  DE: '10',
  DC: '11',
  FL: '12',
  GA: '13',
  HI: '15',
  ID: '16',
  IL: '17',
  IN: '18',
  IA: '19',
  KS: '20',
  KY: '21',
  LA: '22',
  ME: '23',
  MD: '24',
  MA: '25',
  MI: '26',
  MN: '27',
  MS: '28',
  MO: '29',
  MT: '30',
  NE: '31',
  NV: '32',
  NH: '33',
  NJ: '34',
  NM: '35',
  NY: '36',
  NC: '37',
  ND: '38',
  OH: '39',
  OK: '40',
  OR: '41',
  PA: '42',
  RI: '44',
  SC: '45',
  SD: '46',
  TN: '47',
  TX: '48',
  UT: '49',
  VT: '50',
  VA: '51',
  WA: '53',
  WV: '54',
  WI: '55',
  WY: '56',
});
const uuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const validPoint = (p) =>
  Array.isArray(p) &&
  p.length === 2 &&
  [0, 1].every(
    (i) =>
      Object.hasOwn(p, i) && typeof p[i] === 'number' && Number.isFinite(p[i])
  ) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;
const missingLabel =
  'Verified boundary unavailable; location is approximate if supplied.';
const approximateLabel =
  'Approximate town location; verified boundary unavailable.';

/** Private discovery only. Delivery is a trusted caller assertion; output never authorizes serving. */
export async function discoverPrivateTownBoundary(options) {
  const { delivery, connection, communityId, vintage } = options ?? {};
  const rawIdentity = structuredClone(options?.identity),
    archives = structuredClone(options?.archives);
  if (
    !delivery ||
    typeof delivery.geography !== 'function' ||
    !uuid(communityId) ||
    !rawIdentity ||
    !uuid(rawIdentity.sourceEpoch) ||
    !uuid(rawIdentity.activationId) ||
    typeof rawIdentity.socialGeneration !== 'string' ||
    rawIdentity.socialGeneration.length > 19 ||
    !/^[1-9][0-9]*$/.test(rawIdentity.socialGeneration) ||
    BigInt(rawIdentity.socialGeneration) > 9223372036854775807n
  )
    throw Error('Invalid Social source identity');
  const identity = {
    sourceEpoch: rawIdentity.sourceEpoch,
    activationId: rawIdentity.activationId,
    socialGeneration: rawIdentity.socialGeneration,
  };
  async function current() {
    const row = structuredClone(
      await delivery.geography({ ...identity }, communityId)
    );
    if (!row || !['current', 'absent'].includes(row.status))
      throw Error('Invalid Social geography response');
    if (row.status === 'absent') return null;
    if (!uuid(row.changeToken)) throw Error('Invalid Social change token');
    if (row.geography === null) return null;
    const g = row.geography;
    if (
      !g ||
      g.communityId !== communityId ||
      !['city', 'town'].includes(g.localityType)
    )
      throw Error('Invalid Social geography');
    return {
      changeToken: row.changeToken,
      communityId: g.communityId,
      name: g.name,
      city: g.city,
      adminArea: g.adminArea,
      countryCode: g.countryCode,
      localityType: g.localityType,
      referencePoint: g.referencePoint,
    };
  }
  const before = await current();
  if (!before) return { status: 'unavailable' };
  const state =
    typeof before.adminArea === 'string'
      ? before.adminArea.trim().toUpperCase()
      : '';
  const country =
    typeof before.countryCode === 'string'
      ? before.countryCode.trim().toUpperCase()
      : '';
  const city = typeof before.city === 'string' ? before.city.trim() : '';
  const reason = !['US', 'USA'].includes(country)
    ? 'unsupported_country'
    : !states[state]
    ? 'unsupported_administrative_area'
    : !city || city.length > 100 || /[\x00-\x1f\x7f]/.test(city)
    ? 'missing_or_invalid_city'
    : !validPoint(before.referencePoint)
    ? 'missing_or_invalid_reference_point'
    : null;
  const result = reason
    ? { status: 'pending', reason, fallbackLabel: missingLabel }
    : await findCensusBoundaryCandidatesAcross({
        connection,
        archives,
        vintage,
        stateFips: states[state],
        townName: city,
        localityType: before.localityType,
        referencePoint: before.referencePoint,
      });
  const after = await current();
  if (!after || JSON.stringify(before) !== JSON.stringify(after))
    return { status: 'superseded' };
  const approximateLocation = validPoint(before.referencePoint)
    ? { coordinates: [...before.referencePoint], label: approximateLabel }
    : null;
  const reviewContext = {
    communityId: before.communityId,
    name: before.name,
    city: before.city,
    adminArea: before.adminArea,
    countryCode: before.countryCode,
    localityType: before.localityType,
  };
  return {
    ...result,
    reviewContext,
    approximateLocation,
    boundarySearchStatus: 'pending',
    changeToken: before.changeToken,
    sourceIdentity: identity,
  };
}
