import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

type Query={town:string;search:string;category:string;adult:boolean;changeToken:string;bounds?:string;generation?:string};
type Position={reviewed:boolean;scanId:string;row:string};
const validQuery=(q:Query)=>!!q && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.town) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.changeToken) && typeof q.search==='string' && q.search.length<=100 && !/[\x00-\x1f\x7f]/.test(q.search) && typeof q.category==='string' && q.category.length<=100 && (q.category==='' || /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(q.category)) && typeof q.adult==='boolean' && (q.bounds===undefined || (typeof q.bounds==='string' && q.bounds.length<=160)) && (q.generation===undefined || (typeof q.generation==='string' && /^[a-f0-9]{64}$/.test(q.generation)));
const validPosition=(p:Position)=>!!p && typeof p.reviewed==='boolean' && typeof p.scanId==='string' && /^[a-f0-9]{64}$/.test(p.scanId) && typeof p.row==='string' && /^(0|[1-9][0-9]{0,15})$/.test(p.row) && Number.isSafeInteger(Number(p.row));
const normalized=(q:Query)=>[q.town.toLowerCase(),q.search.trim(),q.category,q.adult,q.changeToken.toLowerCase(),q.bounds || '',...(q.generation===undefined?[]:[q.generation])];
function encryptionKey(secret:string){if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw Error('Invalid cursor secret');return createHash('sha256').update(secret).digest()}

/** Encrypted, authenticated local cursor; no internal source identifiers are disclosed. */
export function sealListingCursor(secret:string,query:Query,position:Position,now=Date.now()):string {
 const key=encryptionKey(secret);if(!validQuery(query)||!validPosition(position)||!Number.isSafeInteger(now)||now<0)throw Error('Invalid cursor input');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('local-directory-cursor-v1'));
 const body=Buffer.concat([cipher.update(JSON.stringify({v:1,q:normalized(query),p:position,iat:now}),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');
}
export function openListingCursor(secret:string,query:Query,token:string,now=Date.now()):Position {
 const key=encryptionKey(secret);if(!validQuery(query)||typeof token!=='string'||token.length>2048||!/^[A-Za-z0-9_-]+$/.test(token)||!Number.isSafeInteger(now)||now<0)throw Error('Invalid cursor');
 try{const raw=Buffer.from(token,'base64url');if(raw.length<29||raw.toString('base64url')!==token)throw Error();const decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAAD(Buffer.from('local-directory-cursor-v1'));decipher.setAuthTag(raw.subarray(12,28));const payload=JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8'));if(payload.v!==1||JSON.stringify(payload.q)!==JSON.stringify(normalized(query))||!validPosition(payload.p)||!Number.isSafeInteger(payload.iat)||payload.iat>now||now-payload.iat>900000)throw Error();return payload.p;}catch{throw Error('Invalid cursor')}
}
