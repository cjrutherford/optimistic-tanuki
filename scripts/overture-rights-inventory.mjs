#!/usr/bin/env node
// Aggregate staged metadata only. This does not decide rights or prove completeness.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { pathToFileURL } from 'node:url';

const pairs = [
  ...['meta','Microsoft','BrightQuery','DAC','Overture','Overture-signals','PinMeTo','RenderSEO'].map(dataset => `${dataset}|CDLA-Permissive-2.0`),
  'Foursquare|Apache-2.0', 'AllThePlaces|CC0-1.0',
];
const fields = ['id','sourceFileRowNumber','assignedSeatId','names.primary','basic_category','taxonomy.primary','taxonomy.hierarchy','taxonomy.alternates','geometry','addresses','phones','websites','assignedCategoryIds','assignedPlaceTypeId'];
const maxRecordBytes = 4 * 1024 * 1024;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function present(row,path) {
  let current = row;
  for (const part of path.split('.')) {
    if (!object(current) || !Object.hasOwn(current,part)) return false;
    current = current[part];
  }
  return current !== null;
}
const emptyPairs = () => Object.fromEntries([...pairs,'other'].map(pair=>[pair,0]));
function processLine(bytes, totals) {
  let row;
  try { row = JSON.parse(bytes.toString('utf8')); }
  catch { throw Error(`Malformed JSONL at row ${totals.rowCount + 1}`); }
  if (!object(row)) throw Error(`Invalid object at row ${totals.rowCount + 1}`);
  totals.rowCount++;
  const sources = Array.isArray(row.sources) ? row.sources : [];
  if (!sources.length) totals.recordsMissingSources++;
  for (const source of sources) {
    if (!object(source) || typeof source.dataset !== 'string' || typeof source.license !== 'string') totals.entriesMissingDatasetOrLicense++;
    const key = object(source) ? `${source.dataset}|${source.license}` : '';
    const pair = pairs.includes(key) ? key : 'other';
    totals.sourcePairOccurrences[pair]++;
    const pointer = object(source) ? source.property : undefined;
    if (pointer === '') { totals.sourcePointerOccurrences.root++; totals.rootPairOccurrences[pair]++; }
    else if (pointer === '/properties/confidence') totals.sourcePointerOccurrences.confidence++;
    else if (pointer === '/properties/operating_status') totals.sourcePointerOccurrences.operatingStatus++;
    else totals.sourcePointerOccurrences.otherOrMalformed++;
  }
  for (const field of fields) if (present(row,field)) totals.nonNullFieldPresence[field]++;
}

export async function inventoryJsonl(path) {
  if (typeof path !== 'string' || !path) throw Error('Expected one explicit JSONL path');
  const hash = createHash('sha256');
  const totals = {rowCount:0, recordsMissingSources:0, entriesMissingDatasetOrLicense:0, sourcePairOccurrences:emptyPairs(), rootPairOccurrences:emptyPairs(), sourcePointerOccurrences:{root:0,confidence:0,operatingStatus:0,otherOrMalformed:0}, nonNullFieldPresence:Object.fromEntries(fields.map(field=>[field,0]))};
  let pending = Buffer.alloc(0);
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    pending = pending.length ? Buffer.concat([pending,chunk]) : chunk;
    let newline;
    while ((newline = pending.indexOf(0x0a)) !== -1) {
      const line = pending.subarray(0,newline); pending = pending.subarray(newline+1);
      if (!line.length || line.length > maxRecordBytes) throw Error('Invalid JSONL record size');
      processLine(line,totals);
    }
    if (pending.length > maxRecordBytes) throw Error('Invalid JSONL record size');
  }
  if (pending.length) processLine(pending,totals);
  return {sha256:hash.digest('hex'),...totals};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || !process.argv[2] || process.argv[2].startsWith('--')) {
    process.stderr.write('Usage: node scripts/overture-rights-inventory.mjs <explicit.jsonl>\n'); process.exitCode=1;
  } else inventoryJsonl(process.argv[2]).then(result=>process.stdout.write(`${JSON.stringify(result,null,2)}\n`)).catch(error=>{
    // Do not print parser excerpts, filenames or file contents on failure.
    process.stderr.write(`${/^Malformed JSONL at row \d+$|^Invalid object at row \d+$/.test(error.message) ? error.message : 'Inventory input could not be read'}\n`); process.exitCode=1;
  });
}
