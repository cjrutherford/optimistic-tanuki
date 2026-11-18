import { createHash } from 'node:crypto';
import { EntityManager } from 'typeorm';

const MAX_GEOMETRY_BYTES = 8 * 1024 * 1024;

const position = (p: unknown): boolean =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;
const ring = (r: unknown): boolean =>
  Array.isArray(r) && r.length >= 4 && r.every(position);
const polygon = (p: unknown): boolean =>
  Array.isArray(p) && p.length > 0 && p.every(ring);
function validShape(g: unknown): boolean {
  const geometry = g as { type?: string; coordinates?: unknown } | null;
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return polygon(geometry.coordinates);
  return (
    geometry.type === 'MultiPolygon' &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length > 0 &&
    geometry.coordinates.every(polygon)
  );
}

export function serializeBoundaryGeometry(geometry: unknown): string {
  if (!validShape(geometry)) throw Error('Invalid source geometry');
  const json = JSON.stringify(geometry);
  if (Buffer.byteLength(json) > MAX_GEOMETRY_BYTES)
    throw Error('Source geometry too large');
  return json;
}

export async function validateBoundaryGeometry(
  manager: EntityManager,
  json: string,
  measureArea = false
): Promise<{ geometryHash: string; areaSqKm?: number }> {
  const area = measureArea ? ', ST_Area(g::geography)/1000000.0 AS area' : '';
  const [checked] = await manager.query(
    `SELECT ST_IsValid(g) AND NOT ST_IsEmpty(g) AND ST_SRID(g)=4326 AND GeometryType(g) IN ('POLYGON','MULTIPOLYGON') AS valid, encode(ST_AsEWKB(g,'XDR'),'hex') AS binary${area} FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) g) x`,
    [json]
  );
  if (checked?.valid !== true || typeof checked.binary !== 'string')
    throw Error('Invalid source geometry');
  return {
    geometryHash: createHash('sha256')
      .update(Buffer.from(checked.binary, 'hex'))
      .digest('hex'),
    areaSqKm: measureArea ? Number(checked.area) : undefined,
  };
}
