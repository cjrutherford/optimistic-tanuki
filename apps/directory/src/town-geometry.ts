import { DataSource } from 'typeorm';
import {
  KEEP_OWNER_LOCK_DECISIONS,
  KEEP_OWNER_LOCK_GEOMETRY,
} from './locked-boundary-binding';
import { DirectoryTown, DirectoryTownGeometry } from './entity';

export interface TownInput {
  communityId: string;
  name: string;
  slug: string | null;
  administrativeArea: string | null;
  // Caller derives this from Social's public local-hub city/town policy.
  eligible: boolean;
}
export interface BoundaryInput {
  geometry: unknown;
  source: string;
  vintage: string;
  rights: string;
}

/** Internal contract; onboarding and authorization belong to later slices. */
export class TownGeometryService {
  constructor(private readonly db: DataSource) {}

  async upsertTown(input: TownInput): Promise<DirectoryTown> {
    // One atomic upsert serializes eligibility changes with boundary review.
    await this.db.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [input.communityId]
      );
      if (!input.eligible)
        await manager.query(
          `UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "communityId"=$1 AND "invalidatedAt" IS NULL ${KEEP_OWNER_LOCK_DECISIONS}`,
          [input.communityId]
        );
      if (!input.eligible)
        await manager.query(
          `DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1 ${KEEP_OWNER_LOCK_GEOMETRY}`,
          [input.communityId]
        );
      if (!input.eligible)
        await manager.query(
          'DELETE FROM directory_boundary_candidate WHERE "communityId"=$1',
          [input.communityId]
        );
      await manager.query(
        `INSERT INTO directory_town ("communityId", name, slug, "administrativeArea", eligible)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("communityId") DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug,
      "administrativeArea" = EXCLUDED."administrativeArea", eligible = EXCLUDED.eligible,
      "geometryStatus" = CASE WHEN NOT EXCLUDED.eligible OR NOT directory_town.eligible
        THEN CASE WHEN EXISTS (SELECT 1 FROM directory_boundary_lock l WHERE l."communityId"=directory_town."communityId") THEN directory_town."geometryStatus" ELSE 'pending' END ELSE directory_town."geometryStatus" END`,
        [
          input.communityId,
          input.name,
          input.slug,
          input.administrativeArea,
          input.eligible,
        ]
      );
    });
    return this.db
      .getRepository(DirectoryTown)
      .findOneByOrFail({ communityId: input.communityId });
  }

  async withdrawTown(communityId: string): Promise<void> {
    // Do not persist private or wrong-scope descriptions for previously unseen IDs.
    await this.db.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [communityId]
      );
      await manager.query(
        `UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "communityId"=$1 AND "invalidatedAt" IS NULL ${KEEP_OWNER_LOCK_DECISIONS}`,
        [communityId]
      );
      await manager.query(
        `DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1 ${KEEP_OWNER_LOCK_GEOMETRY}`,
        [communityId]
      );
      await manager.query(
        'DELETE FROM directory_boundary_candidate WHERE "communityId"=$1',
        [communityId]
      );
      await manager.query(
        `UPDATE directory_town SET eligible = false, "geometryStatus" = CASE WHEN EXISTS (SELECT 1 FROM directory_boundary_lock l WHERE l."communityId"=directory_town."communityId") THEN "geometryStatus" ELSE 'pending' END WHERE "communityId" = $1`,
        [communityId]
      );
    });
  }

  async setBoundary(
    communityId: string,
    input: BoundaryInput
  ): Promise<'ready' | 'invalid'> {
    return this.db.transaction(async (manager) => {
      const town = await manager.getRepository(DirectoryTown).findOne({
        where: { communityId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!town) throw new Error('Unknown town');
      if (!town.eligible) throw new Error('Ineligible town');
      const locked = await manager.query(
        'SELECT 1 FROM directory_boundary_lock WHERE "communityId"=$1',
        [communityId]
      );
      if (locked.length) throw new Error('Boundary is locked');
      let valid = false;
      // Validate coordinates before asking PostGIS to parse. This also rejects NaN,
      // extra dimensions and out-of-range coordinates, including all rings/holes.
      const geo = input.geometry as {
        type?: string;
        coordinates?: unknown;
      } | null;
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
      const coordinatesValid =
        geo?.type === 'Polygon'
          ? polygon(geo.coordinates)
          : geo?.type === 'MultiPolygon' &&
            Array.isArray(geo.coordinates) &&
            geo.coordinates.length > 0 &&
            geo.coordinates.every(polygon);
      if (
        geo &&
        coordinatesValid &&
        input.source?.trim() &&
        input.vintage?.trim() &&
        input.rights?.trim()
      ) {
        // A savepoint keeps malformed GeoJSON from aborting the enclosing transaction.
        await manager.query('SAVEPOINT geometry_parse');
        try {
          const rows = await manager.query(
            `SELECT ST_IsValid(g) AND NOT ST_IsEmpty(g) AND ST_SRID(g) = 4326 AND GeometryType(g) IN ('POLYGON','MULTIPOLYGON') AS valid FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) g) x`,
            [JSON.stringify(geo)]
          );
          valid = rows[0].valid === true;
        } catch {
          await manager.query('ROLLBACK TO SAVEPOINT geometry_parse');
        }
        await manager.query('RELEASE SAVEPOINT geometry_parse');
      }
      if (!valid) {
        town.geometryStatus = 'invalid';
        await manager.save(town);
        return 'invalid';
      }
      const version = town.geometryVersion + 1;
      await manager.getRepository(DirectoryTownGeometry).insert({
        communityId,
        version,
        boundary: geo as object,
        source: input.source,
        vintage: input.vintage,
        rights: input.rights,
      });
      town.geometryVersion = version;
      town.geometryStatus = 'ready';
      await manager.save(town);
      return 'ready';
    });
  }

  async validateTownPoint(
    communityId: string,
    longitude: number,
    latitude: number
  ): Promise<{
    status: 'pending' | 'invalid' | 'ineligible' | 'ready';
    covers?: boolean;
  }> {
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 ||
      Math.abs(latitude) > 90
    )
      throw new Error('Invalid WGS84 point');
    const town = await this.db
      .getRepository(DirectoryTown)
      .findOneBy({ communityId });
    if (!town) throw new Error('Unknown town');
    if (!town.eligible) return { status: 'ineligible' };
    if (town.geometryStatus !== 'ready')
      return { status: town.geometryStatus as 'pending' | 'invalid' };
    const rows = await this.db.query(
      `SELECT ST_Covers(boundary, ST_SetSRID(ST_MakePoint($3, $4), 4326)) AS covers FROM directory_town_geometry WHERE "communityId" = $1 AND version = $2`,
      [communityId, town.geometryVersion, longitude, latitude]
    );
    if (!rows.length) throw new Error('Ready town has no geometry');
    return { status: 'ready', covers: rows[0].covers };
  }

  async townsCoveringPoint(
    longitude: number,
    latitude: number
  ): Promise<{
    kind: 'geometry-candidates';
    complete: false;
    communityIds: string[];
    ambiguous: boolean;
  }> {
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 ||
      Math.abs(latitude) > 90
    )
      throw new Error('Invalid WGS84 point');
    const rows = await this.db.query(
      `SELECT t."communityId" FROM directory_town t JOIN directory_town_geometry g ON g."communityId" = t."communityId" AND g.version = t."geometryVersion" WHERE t.eligible AND t."geometryStatus" = 'ready' AND ST_Covers(g.boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326)) ORDER BY t."communityId"`,
      [longitude, latitude]
    );
    return {
      kind: 'geometry-candidates',
      complete: false,
      communityIds: rows.map((row: { communityId: string }) => row.communityId),
      ambiguous: rows.length > 1,
    };
  }
}
