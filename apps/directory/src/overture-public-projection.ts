import { isIP } from 'node:net';
import { projectPrivateOverture } from './overture-private-projection';
import { evaluateOvertureFieldRights, OvertureRightsPolicy } from './overture-rights';

type Source = Parameters<typeof projectPrivateOverture>[0] & {websites?:unknown;phones?:unknown;addresses?:unknown};
type Classification = NonNullable<Parameters<typeof projectPrivateOverture>[1]> & {websiteVerified?:boolean;phoneVerified?:boolean;addressVerified?:boolean};

/** Public projection foundation. Policy and classification require trusted independent authority. */
export function projectPublicOverture(row: Source, classification: Classification | undefined, policy: OvertureRightsPolicy | undefined, visitorAdultOptIn: boolean) {
  const denied = {status:'quarantined' as const};
  if (!policy || !Array.isArray(policy.terms) || policy.terms.some(term => !term || !term.permissions) || !classification || (classification.adult === true && visitorAdultOptIn !== true)) return denied;
  const decision = evaluateOvertureFieldRights(row, 'publicDisplay', policy);
  if (!decision.eligible) return denied;
  // Reuse the private projector's strict shape and classification validation while
  // binding its display permission to the actual public-display grant.
  const publicPolicy: OvertureRightsPolicy = {
    ...policy,
    operations: {...policy.operations, privateDisplay: policy.operations.publicDisplay},
    terms: policy.terms.map(term=>({...term,permissions:{...term.permissions,privateDisplay:term.permissions.publicDisplay}})),
  };
  const result = projectPrivateOverture(row,{...classification,adultOptIn: visitorAdultOptIn === true},publicPolicy);
  if (result.status !== 'eligible') return denied;
  const listing: typeof result.listing & {website?:string;phone?:string;address?:string} = {...result.listing};
  const used: string[] = [];
  const hasVerified = (key: keyof Classification) => Object.prototype.hasOwnProperty.call(classification,key) && classification[key] === true;
  const first = (v:unknown) => Array.isArray(v) && v.length === 1 ? v[0] : undefined;
  if (hasVerified('websiteVerified') && decision.fields.website.status === 'eligible') {
    try {
      const value=first(row.websites); if (typeof value !== 'string' || value.length>2048) throw Error('Invalid website');
      const url=new URL(value), host=url.hostname.toLowerCase().replace(/\.$/,'');
      if (!['https:','http:'].includes(url.protocol) || url.username || url.password || !host.includes('.') || isIP(host.replace(/^\[|\]$/g,'')) || /(?:^|\.)(localhost|local|internal)$/.test(host)) throw Error('Invalid website');
      listing.website=url.href; used.push('website');
    } catch { /* Invalid optional fields stay hidden. */ }
  }
  const phone=first(row.phones);
  if (hasVerified('phoneVerified') && decision.fields.phone.status === 'eligible' && typeof phone==='string' && /^\+[1-9][0-9]{6,14}$/.test(phone)) {listing.phone=phone;used.push('phone');}
  const address=first(row.addresses);
  if (hasVerified('addressVerified') && decision.fields.address.status === 'eligible' && address && typeof address==='object' && Object.prototype.hasOwnProperty.call(address,'freeform')) {
    const value=(address as {freeform?:unknown}).freeform;
    if (typeof value==='string' && value.trim() && value.length<=300 && !/[\x00-\x1f\x7f]/.test(value)) {listing.address=value.trim();used.push('address');}
  }
  for (const field of used) {
    const rights=decision.fields[field];
    listing.attribution=[...new Set([...listing.attribution,...rights.attributions])];
    listing.notices=[...new Set([...listing.notices,...rights.notices])];
    listing.termsUrls=[...new Set([...listing.termsUrls,...rights.termsUrls])];
  }
  return {status:'eligible' as const,listing};
}
