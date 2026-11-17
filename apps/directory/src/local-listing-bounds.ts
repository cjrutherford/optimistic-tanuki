export type ListingBounds={west:number;south:number;east:number;north:number;canonical:string};

/** Parse a small, non-wrapping WGS84 search area. */
export function parseListingBounds(value:string):ListingBounds {
 if(typeof value!=='string'||value.length>160)throw Error('Invalid bounds');
 const parts=value.split(',');
 if(parts.length!==4||parts.some(part=>! /^-?(?:0|[1-9]\d*)(?:\.\d{1,9})?$/.test(part)))throw Error('Invalid bounds');
 const [west,south,east,north]=parts.map(Number);
 if(![west,south,east,north].every(Number.isFinite)||west < -180||east>180||south < -90||north>90||west>=east||south>=north||east-west>2||north-south>2)throw Error('Invalid bounds');
 return {west,south,east,north,canonical:[west,south,east,north].join(',')};
}
