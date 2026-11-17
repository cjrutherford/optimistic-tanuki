import { createHash, createHmac } from 'node:crypto';

const hash=/^[a-f0-9]{64}$/;
const label=/^[a-z0-9][a-z0-9._-]{0,99}$/;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const digest=value=>createHash('sha256').update(value).digest('hex');
const key=(town,contributor)=>JSON.stringify([town,contributor]);

/** Synthetic planning primitive; a caller must independently freeze and approve the inputs before use. */
export function planQualitySample({frame,allocation,seed,releaseSha256,protocolSha256,targetCount}={}) {
  if (typeof seed!=='string' || !hash.test(seed)) throw Error('A 32-byte hexadecimal seed is required');
  if (![releaseSha256,protocolSha256].every(x=>typeof x==='string' && hash.test(x))) throw Error('Pinned release and protocol fingerprints required');
  if (!Array.isArray(frame) || frame.length>200000 || !Array.isArray(allocation) || !Number.isSafeInteger(targetCount) || targetCount<0 || targetCount>frame.length) throw Error('Invalid sampling frame or allocation');
  const ids=new Set(),groups=new Map(),normalized=[];
  for (let i=0;i<frame.length;i++) {
    if (!Object.hasOwn(frame,i)) throw Error('Invalid sampling frame');
    const row=frame[i];
    if (!row || typeof row!=='object' || !['id','town','contributor'].every(k=>Object.hasOwn(row,k)) || typeof row.id!=='string' || !hash.test(row.id) || typeof row.town!=='string' || !label.test(row.town) || typeof row.contributor!=='string' || !label.test(row.contributor)) throw Error('Invalid sampling frame');
    if (ids.has(row.id)) throw Error('Duplicate record identity');ids.add(row.id);
    const copy={id:row.id,town:row.town,contributor:row.contributor},group=key(copy.town,copy.contributor);
    normalized.push(copy);if (!groups.has(group)) groups.set(group,[]);groups.get(group).push(copy);
  }
  const counts=new Map();
  for (let i=0;i<allocation.length;i++) {
    if (!Object.hasOwn(allocation,i)) throw Error('Invalid allocation');
    const a=allocation[i];
    if (!a || typeof a!=='object' || !['town','contributor','count'].every(k=>Object.hasOwn(a,k)) || typeof a.town!=='string' || !label.test(a.town) || typeof a.contributor!=='string' || !label.test(a.contributor) || !Number.isSafeInteger(a.count) || a.count<0) throw Error('Invalid allocation');
    const group=key(a.town,a.contributor);if (counts.has(group) || !groups.has(group) || a.count>groups.get(group).length) throw Error('Invalid allocation');counts.set(group,a.count);
  }
  if (counts.size!==groups.size || [...counts.values()].reduce((a,b)=>a+b,0)!==targetCount) throw Error('Incomplete allocation');
  normalized.sort((a,b)=>cmp(a.id,b.id));
  const frameSha256=digest(JSON.stringify(normalized)),selected=[],strata=[];
  for (const group of [...groups.keys()].sort(cmp)) {
    const rows=groups.get(group),count=counts.get(group),[town,contributor]=JSON.parse(group);
    const ranked=rows.map(row=>({row,rank:createHmac('sha256',Buffer.from(seed,'hex')).update('s4a2-sample-v1\0').update(JSON.stringify([row.town,row.contributor,row.id])).digest('hex')})).sort((a,b)=>cmp(a.rank,b.rank)||cmp(a.row.id,b.row.id));
    strata.push({town,contributor,population:rows.length,selected:count});
    for (const item of ranked.slice(0,count)) selected.push({...item.row,probability:{numerator:count,denominator:rows.length}});
  }
  const core={version:'s4a2-sample-v1',releaseSha256,protocolSha256,frameSha256,seed,frameSize:frame.length,sampleSize:selected.length,coverage:frame.length>0 && strata.every(x=>x.selected>0)?'all-strata-represented':'incomplete',strata,selected};
  return {...core,planSha256:digest(JSON.stringify(core))};
}
