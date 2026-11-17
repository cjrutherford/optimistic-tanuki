import { evaluateOvertureFieldRights, OvertureRightsPolicy, OvertureRightsSource } from './overture-rights';

type Row={releaseId?:string;sources?:readonly OvertureRightsSource[];names?:{primary?:unknown};basic_category?:unknown;taxonomy?:{primary?:unknown;hierarchy?:unknown};geometry?:{type?:unknown;coordinates?:unknown};assignedCategoryIds?:unknown;addresses?:unknown};
const sensitive=/\b(shelter|safe|haven|refuge|domestic|violence|victim|abuse|crisis|trafficking|recovery|rehab|addiction|homeless|food[ -]?(pantry|bank)|free[ -]?meal|transition|transitional|treatment|reentry|outreach|charity|charitable|nonprofit|mental|family[ -]?services|women|youth|pregnancy|suicide|hiv|sober|prison|jail|correctional|clinic|hospital|medical|health[ -]?care)\b/i;

/** Narrow local-only adult projection; visitor consent is enforced when serving. */
export function projectLocalAdult(row:Row,policy:OvertureRightsPolicy|undefined) {
 const denied={status:'quarantined' as const};
 if (!row || row.basic_category!=='adult_entertainment_venue' || typeof row.names?.primary!=='string' || !row.names.primary.trim() || row.names.primary.length>200 || /[\x00-\x1f\x7f]/.test(row.names.primary) || row.taxonomy?.primary!=='adult_entertainment_venue' || !Array.isArray(row.taxonomy.hierarchy) || !row.taxonomy.hierarchy.length || !row.taxonomy.hierarchy.every((x:unknown)=>typeof x==='string'&&!!x.trim()) || !Array.isArray(row.assignedCategoryIds) || !row.assignedCategoryIds.includes('adult')) return denied;
 if(sensitive.test(JSON.stringify([row.names.primary,row.basic_category,row.taxonomy,row.addresses]).replace(/_/g,' ')))return denied;
 const c=row.geometry?.coordinates;
 if(row.geometry?.type!=='Point'||!Array.isArray(c)||c.length!==2||![0,1].every(i=>Object.prototype.hasOwnProperty.call(c,i)&&typeof c[i]==='number'&&Number.isFinite(c[i]))||Math.abs(c[0])>180||Math.abs(c[1])>90)return denied;
 const decisions=(['ingest','retain','privateDisplay'] as const).map(op=>evaluateOvertureFieldRights(row,op,policy));
 if(decisions.some(x=>!x.eligible))return denied;
 const fields=decisions.flatMap(d=>Object.values(d.fields)),attribution=[...new Set(fields.flatMap(x=>x.attributions))];if(!attribution.length)return denied;
 return {status:'eligible' as const,listing:{name:row.names.primary,category:row.basic_category,location:{type:'Point' as const,coordinates:[c[0],c[1]] as [number,number]},attribution,notices:[...new Set(fields.flatMap(x=>x.notices))],termsUrls:[...new Set(fields.flatMap(x=>x.termsUrls))],adult:true}};
}
