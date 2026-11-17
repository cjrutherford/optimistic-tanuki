import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';

// Texas's pinned 2026 county-subdivision archive exceeds 16 MiB; the
// independent extracted-member and total limits still apply.
const MAX_ARCHIVE = 32 * 1024 * 1024,
  MAX_MEMBER = 64 * 1024 * 1024,
  MAX_TOTAL = 128 * 1024 * 1024;
const NAD83_WKT =
  'GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]';
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const validPosition = (p) =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every(Number.isFinite) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;
const validRing = (r) =>
  Array.isArray(r) && r.length >= 4 && r.every(validPosition);
const validPolygon = (p) =>
  Array.isArray(p) && p.length > 0 && p.every(validRing);
const validGeometry = (g) =>
  !!g &&
  (g.type === 'Polygon'
    ? validPolygon(g.coordinates)
    : g.type === 'MultiPolygon' &&
      Array.isArray(g.coordinates) &&
      g.coordinates.length > 0 &&
      g.coordinates.every(validPolygon));

/** Private candidate only. A caller-provided digest, GEOID and point do not prove identity or authorization. */
export async function readCensusBoundaryCandidate(options) {
  return readCensusArchive(options, 'geoid');
}

/** Searches one archive only; every result remains unverified and other layers may contain matches. */
export async function findCensusBoundaryCandidates(options) {
  return readCensusArchive(options, 'name');
}

async function readCensusArchive(options, mode) {
  const {
    connection,
    archivePath,
    archiveSha256,
    archiveBytes,
    vintage,
    stateFips,
    layer,
    geoid,
    townName,
    localityType,
    referencePoint,
  } = { ...options, referencePoint: structuredClone(options?.referencePoint) };
  if (
    !connection ||
    typeof connection.run !== 'function' ||
    typeof connection.runAndReadAll !== 'function'
  )
    throw Error('Dedicated spatial connection required');
  if (
    typeof archivePath !== 'string' ||
    !archivePath ||
    typeof archiveSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(archiveSha256) ||
    !Number.isSafeInteger(archiveBytes) ||
    archiveBytes < 1 ||
    archiveBytes > MAX_ARCHIVE
  )
    throw Error('Invalid approved archive size or digest');
  if (
    typeof vintage !== 'string' ||
    !/^20[0-9]{2}$/.test(vintage) ||
    typeof stateFips !== 'string' ||
    !/^[0-9]{2}$/.test(stateFips) ||
    !['place', 'cousub'].includes(layer)
  )
    throw Error('Invalid Census archive identity');
  const validGeoid = (value) =>
    typeof value === 'string' &&
    (layer === 'place' ? /^[0-9]{7}$/ : /^[0-9]{10}$/).test(value) &&
    value.startsWith(stateFips);
  if (mode === 'geoid' && !validGeoid(geoid))
    throw Error('GEOID and state do not match');
  if (
    mode === 'name' &&
    (typeof townName !== 'string' ||
      !townName.trim() ||
      townName.length > 100 ||
      /[\x00-\x1f\x7f]/.test(townName) ||
      !['city', 'town'].includes(localityType))
  )
    throw Error('Valid town name and type required');
  if (
    !Array.isArray(referencePoint) ||
    referencePoint.length !== 2 ||
    ![0, 1].every(
      (i) =>
        Object.hasOwn(referencePoint, i) &&
        typeof referencePoint[i] === 'number' &&
        Number.isFinite(referencePoint[i])
    ) ||
    Math.abs(referencePoint[0]) > 180 ||
    Math.abs(referencePoint[1]) > 90
  )
    throw Error('Valid reference point required');
  const stem = `tl_${vintage}_${stateFips}_${layer}`,
    dir = await mkdtemp(join(tmpdir(), 'census-boundary-'));
  const snapshot = join(dir, 'input.zip');
  let reader;
  try {
    const input = await open(archivePath, 'r'),
      hash = createHash('sha256');
    let size = 0;
    try {
      const stat = await input.stat();
      if (!stat.isFile() || stat.size !== archiveBytes)
        throw Error('Archive size mismatch');
      await pipeline(
        input.createReadStream({ autoClose: false }),
        new Transform({
          transform(chunk, _encoding, done) {
            size += chunk.length;
            if (size > archiveBytes)
              return done(Error('Archive size exceeds approved size'));
            hash.update(chunk);
            done(null, chunk);
          },
        }),
        createWriteStream(snapshot, { mode: 0o600, flags: 'wx' })
      );
    } finally {
      await input.close();
    }
    if (size !== archiveBytes) throw Error('Archive size mismatch');
    if (hash.digest('hex') !== archiveSha256)
      throw Error('Archive digest mismatch');
    const bytes = await readFile(snapshot);
    reader = new ZipReader(new BlobReader(new Blob([bytes])));
    const entries = await reader.getEntries();
    let total = 0;
    if (entries.length > 64) throw Error('Too many archive members');
    const names = new Set();
    for (const entry of entries) {
      if (
        entry.directory ||
        !entry.filename ||
        entry.filename.includes('/') ||
        entry.filename.includes('\\') ||
        names.has(entry.filename)
      )
        throw Error('Unsafe or duplicate archive member');
      names.add(entry.filename);
      if (
        !Number.isSafeInteger(entry.uncompressedSize) ||
        entry.uncompressedSize < 0 ||
        entry.uncompressedSize > MAX_MEMBER
      )
        throw Error('Archive member exceeds limit');
      total += entry.uncompressedSize;
      if (total > MAX_TOTAL)
        throw Error('Archive uncompressed size exceeds limit');
    }
    for (const ext of ['shp', 'shx', 'dbf', 'prj'])
      if (!names.has(`${stem}.${ext}`))
        throw Error('Expected Census shapefile members missing');
    const projection = entries.find(
      (entry) => entry.filename === `${stem}.prj`
    );
    if (projection.uncompressedSize > 4096)
      throw Error('Projection metadata exceeds limit');
    const projectionBytes = await projection.getData(new Uint8ArrayWriter());
    if (
      new TextDecoder('utf-8', { fatal: true })
        .decode(projectionBytes)
        .trim() !== NAD83_WKT
    )
      throw Error('Unsupported Census coordinate reference system');
    await reader.close();
    reader = undefined;
    await connection.run(
      "SET threads = 1; SET memory_limit = '512MB'; SET max_temp_directory_size = '0B'"
    );
    const shape = `/vsizip/${snapshot}/${stem}.shp`;
    const transformed =
      "ST_Transform(geom, 'EPSG:4269', 'EPSG:4326', always_xy := true)";
    const match =
      mode === 'geoid'
        ? `GEOID = ${quote(geoid)}`
        : `lower(trim(NAME)) = lower(${quote(
            townName.trim()
          )}) AND LSAD = ${quote(localityType === 'city' ? '25' : '43')}`;
    const extra = mode === 'geoid' ? `, ST_AsGeoJSON(${transformed})` : '';
    const query = `SELECT GEOID, STATEFP, NAME, LSAD, CAST(ST_GeometryType(${transformed}) AS VARCHAR), ST_IsValid(${transformed}), ST_IsEmpty(${transformed}), ST_Covers(${transformed}, ST_Point(${
      referencePoint[0]
    }, ${referencePoint[1]}))${extra} FROM ST_Read(${quote(
      shape
    )}) WHERE ${match} ORDER BY GEOID LIMIT 101`;
    const rows = await (await connection.runAndReadAll(query)).getRowsJS();
    if (mode === 'name') {
      if (rows.length > 100) throw Error('Too many Census name matches');
      const seen = new Set(),
        candidateGeoids = [];
      for (const [id, state, name, lsad, type, valid, empty, covers] of rows) {
        if (
          !validGeoid(id) ||
          state !== stateFips ||
          typeof name !== 'string' ||
          !name ||
          typeof lsad !== 'string' ||
          !['POLYGON', 'MULTIPOLYGON'].includes(type) ||
          valid !== true ||
          empty !== false ||
          typeof covers !== 'boolean' ||
          seen.has(id)
        )
          throw Error('Invalid or duplicate Census name match');
        seen.add(id);
        if (covers) candidateGeoids.push(id);
      }
      return {
        status:
          candidateGeoids.length === 0
            ? 'pending'
            : candidateGeoids.length === 1
            ? 'candidate'
            : 'ambiguous',
        candidateGeoids,
        vintage,
        stateFips,
        layer,
        sourceSha256: archiveSha256,
        sourceBytes: archiveBytes,
        sourceReference: `https://www2.census.gov/geo/tiger/TIGER${vintage}/${layer.toUpperCase()}/${stem}.zip`,
        sourceAuthorityVerified: false,
        communityIdentityVerified: false,
        crossLayerSearchRequired: true,
        fallbackLabel:
          candidateGeoids.length === 0
            ? 'Verified boundary unavailable; location is approximate if supplied.'
            : null,
        warning:
          'Results cover one archive only and do not verify community identity.',
      };
    }
    if (!rows.length) throw Error('Census GEOID not found');
    if (rows.length !== 1) throw Error('Ambiguous Census GEOID');
    const [
      actualId,
      actualState,
      name,
      lsad,
      type,
      valid,
      empty,
      covers,
      json,
    ] = rows[0];
    if (
      actualId !== geoid ||
      actualState !== stateFips ||
      typeof name !== 'string' ||
      !name ||
      typeof lsad !== 'string' ||
      !['POLYGON', 'MULTIPOLYGON'].includes(type) ||
      valid !== true ||
      empty !== false ||
      typeof json !== 'string' ||
      json.length > MAX_MEMBER
    )
      throw Error('Invalid Census boundary geometry or identity');
    if (covers !== true) throw Error('Reference point outside Census boundary');
    const geometry = JSON.parse(json);
    if (!validGeometry(geometry)) throw Error('Invalid WGS84 GeoJSON boundary');
    return {
      status: 'candidate',
      sourceAuthorityVerified: false,
      communityIdentityVerified: false,
      geoid,
      stateFips,
      layer,
      vintage,
      name,
      lsad,
      geometry,
      sourceSha256: archiveSha256,
      sourceBytes: archiveBytes,
      sourceReference: `https://www2.census.gov/geo/tiger/TIGER${vintage}/${layer.toUpperCase()}/${stem}.zip`,
      attribution: 'U.S. Census Bureau TIGER/Line',
      warning:
        'Candidate only: matching the reference point does not verify the community identity or authorize public use.',
    };
  } finally {
    if (reader) await reader.close();
    await rm(dir, { recursive: true, force: true });
  }
}

/** Compare Places and County Subdivisions; this does not establish that they cover every jurisdiction. */
export async function findCensusBoundaryCandidatesAcross(options) {
  const { connection, vintage, stateFips, townName, localityType } =
    options ?? {};
  const archives = structuredClone(options?.archives),
    referencePoint = structuredClone(options?.referencePoint);
  if (
    !Array.isArray(archives) ||
    archives.length !== 2 ||
    archives.some(
      (a) =>
        !a || typeof a !== 'object' || !['place', 'cousub'].includes(a.layer)
    ) ||
    new Set(archives.map((a) => a.layer)).size !== 2
  )
    throw Error('Both distinct Census layers are required');
  const candidates = [];
  for (const layer of ['place', 'cousub']) {
    const archive = archives.find((a) => a.layer === layer);
    const result = await findCensusBoundaryCandidates({
      ...archive,
      connection,
      vintage,
      stateFips,
      townName,
      localityType,
      referencePoint,
      layer,
    });
    for (const geoid of result.candidateGeoids)
      candidates.push({
        geoid,
        layer,
        vintage: result.vintage,
        stateFips: result.stateFips,
        sourceSha256: result.sourceSha256,
        sourceBytes: result.sourceBytes,
        sourceReference: result.sourceReference,
      });
  }
  return {
    status:
      candidates.length === 0
        ? 'pending'
        : candidates.length === 1
        ? 'candidate'
        : 'ambiguous',
    candidates,
    searchedLayers: ['place', 'cousub'],
    otherLayersMayBeNeeded: true,
    sourceAuthorityVerified: false,
    communityIdentityVerified: false,
    fallbackLabel:
      candidates.length === 0
        ? 'Verified boundary unavailable; location is approximate if supplied.'
        : null,
    warning:
      'Candidates do not verify community identity; other Census layers or sources may be needed.',
  };
}
