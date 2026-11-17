// Synthetic-only S4a.2 policy evaluator. No file, network, or provider access.
// This module is intentionally not wired to an application or public route.
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const operations = ['store', 'privateDisplay', 'publicDisplay', 'export', 'search', 'map', 'cache'];
const publicFields = ['name', 'businessLocation', 'category', 'provenance', 'freshness', 'website', 'phone', 'streetAddress'];
const verifiedBusinessFields = new Set(['website','phone','streetAddress']);
const restrictedFields = new Set(['email', 'personalDetails', 'residentialDetails', 'enrichment', 'confidence', 'operatingStatus', 'sourceId', 'rowNumber', 'seatId']);

function isAllowed(decision, operation) {
  return object(decision) && Object.hasOwn(decision,operation) && decision[operation] === 'allow';
}

function lineageDecision(lineage, policy, operation) {
  if (!Array.isArray(lineage) || lineage.length === 0) return false;
  return Array.from({length:lineage.length},(_,i)=>{
    if (!Object.hasOwn(lineage,i)) return false;
    const item=lineage[i];
    if (!object(item) || !Object.hasOwn(item,'dataset') || !Object.hasOwn(item,'license') || typeof item.dataset!=='string' || !item.dataset || typeof item.license!=='string' || !item.license || !object(policy.sources)) return false;
    const key=`${item.dataset}|${item.license}`;
    if (!Object.hasOwn(policy.sources,key)) return false;
    const grant=policy.sources[key];
    if (!object(grant) || !Object.hasOwn(grant,'requiredNotices') || !Array.isArray(grant.requiredNotices) || !Array.isArray(policy.attribution)) return false;
    if (!Array.from({length:grant.requiredNotices.length},(_,j)=>Object.hasOwn(grant.requiredNotices,j) && typeof grant.requiredNotices[j]==='string' && !!grant.requiredNotices[j].trim() && policy.attribution.includes(grant.requiredNotices[j])).every(Boolean)) return false;
    return Object.hasOwn(grant,operation) && isAllowed(grant,operation);
  }).every(Boolean);
}

function safeBusinessWebsite(value) {
  if (typeof value!=='string' || value.length>2048) return false;
  try {
    const url=new URL(value), host=url.hostname.toLowerCase();
    return ['http:','https:'].includes(url.protocol) && !url.username && !url.password && host.includes('.') && !/^[0-9.]+$/.test(host) && !host.includes(':') && !['.local','.internal','.test','.invalid'].some(suffix=>host.endsWith(suffix));
  } catch {return false;}
}

function safeValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function evaluateRecord(record, policy) {
  const reasons = [];
  if (!object(record) || !object(policy) || !Object.hasOwn(record,'fields') || !Object.hasOwn(record,'lineage') || !Object.hasOwn(policy,'requiredFields') || !object(record.fields) || !object(record.lineage) || !Array.isArray(policy.requiredFields)) {
    return { allowed: false, reasons: ['invalid-input'], projection: null };
  }
  const operationsPolicy = object(policy.operations) ? policy.operations : {};
  const gates = Object.fromEntries(operations.map(op => [op, isAllowed(operationsPolicy,op)]));
  if (!isAllowed(operationsPolicy,'store') || !isAllowed(operationsPolicy,'privateDisplay')) {
    return { allowed: false, reasons: ['operation-not-authorized'], projection: null, gates };
  }
  for (const field of policy.requiredFields) {
    if (restrictedFields.has(field) || !Object.hasOwn(record.fields, field) || record.fields[field] == null ||
      !Object.hasOwn(record.lineage,field) || !lineageDecision(record.lineage[field], policy, 'store') || !lineageDecision(record.lineage[field], policy, 'privateDisplay')) {
      reasons.push(`required-field-quarantined:${field}`);
      return { allowed: false, reasons, projection: null, gates };
    }
  }
  const projection = {};
  for (const field of publicFields) {
    if (restrictedFields.has(field) || !Object.hasOwn(record.fields, field) || record.fields[field] == null) continue;
    if (verifiedBusinessFields.has(field) && (!object(record.verifiedBusinessFields) || !Object.hasOwn(record.verifiedBusinessFields,field) || record.verifiedBusinessFields[field]!==true)) continue;
    if (field==='website' && !safeBusinessWebsite(record.fields[field])) continue;
    if (!Object.hasOwn(record.lineage,field)) continue;
    const line = record.lineage[field];
    if (!lineageDecision(line, policy, 'store') || !lineageDecision(line, policy, 'privateDisplay') || !lineageDecision(line, policy, 'publicDisplay')) continue;
    projection[field] = record.fields[field];
  }
  if (!projection.name || !projection.businessLocation || !projection.category) {
    return { allowed: false, reasons: [...reasons, 'public-candidate-incomplete'], projection: null, gates };
  }
  const adultOkay = Object.hasOwn(record,'adultClassification') && ['non-adult','adult'].includes(record.adultClassification);
  if (!Object.hasOwn(record,'sensitiveLocation') || !Object.hasOwn(record,'residential') || record.sensitiveLocation !== false || record.residential !== false || !adultOkay) {
    return { allowed: false, reasons: [...reasons, 'sensitive-or-ineligible-record'], projection: null, gates };
  }
  if (!Object.values(projection).every(safeValue)) return { allowed: false, reasons: [...reasons, 'unsafe-projection-value'], projection: null, gates };
  // Every surfaced field must have a complete lineage decision for that operation.
  for (const op of operations) {
    gates[op] = isAllowed(operationsPolicy,op) && Object.keys(projection).every(field => lineageDecision(record.lineage[field], policy, op));
  }
  const attribution = Array.isArray(policy.attribution) ? policy.attribution.filter(x => typeof x === 'string' && x.length > 0) : [];
  if (attribution.length !== (policy.attribution ?? []).length || attribution.length === 0) {
    return { allowed: false, reasons: [...reasons, 'attribution-incomplete'], projection: null, gates };
  }
  return { allowed: true, reasons: [], projection, gates, attribution, adult:record.adultClassification==='adult', withdrawn: false, withdrawal: { invalidates: ['projection', 'search', 'map', 'cache', 'export'], required: true, scope: 'this in-memory evaluation only' } };
}

// Invalidates only this in-memory evaluation. Persistence/index/cache invalidation is unimplemented.
export function withdraw(evaluation) {
  if (!evaluation || typeof evaluation !== 'object') return;
  evaluation.withdrawn = true;
  evaluation.projection = null;
  evaluation.gates = Object.fromEntries(operations.map(op => [op, false]));
}

export function readProjection(evaluation, surface, visitor = undefined) {
  if (!evaluation?.allowed || evaluation.withdrawn === true || !object(evaluation.projection) || !['privateDisplay', 'publicDisplay', 'search', 'map', 'cache', 'export'].includes(surface)) return null;
  if (surface === 'export') return null;
  if (evaluation.adult && (surface==='cache' || !object(visitor) || !Object.hasOwn(visitor,'adultOptIn') || visitor.adultOptIn!==true)) return null;
  if (evaluation.gates?.[surface] !== true) return null;
  if (!Array.isArray(evaluation.attribution) || evaluation.attribution.length === 0) return null;
  return { projection: { ...evaluation.projection }, attribution: [...evaluation.attribution], proofScope: 'in-memory evaluation only' };
}
