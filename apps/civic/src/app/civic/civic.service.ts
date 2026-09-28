import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import {
  sanitizeTenantId,
  TenantRlsTransactionManager,
  withTenantRlsTransaction,
} from '@optimistic-tanuki/business-security';
import {
  extractDocumentText,
  DocumentExtractionError,
} from '@optimistic-tanuki/document-text';
import {
  CivicAgendaDto,
  EmergencyBroadcastDto,
  IngestAgendaDto,
  ImportAgendaSourceDto,
  PublishBroadcastDto,
  RegisterTipProjectDto,
  TipProjectSpatialDto,
  CivicMeetingBody,
} from '@optimistic-tanuki/models';
import { CivicAgenda } from '../entities/civic-agenda.entity';
import { CivicAgendaItem } from '../entities/civic-agenda-item.entity';
import { TipProject } from '../entities/tip-project.entity';
import { EmergencyBroadcast } from '../entities/emergency-broadcast.entity';
import {
  agendaHtmlToText,
  discoverAgendaLinks,
} from './agenda-source-discovery';

const MAX_AGENDA_BYTES = 10 * 1024 * 1024;
const AGENDA_FETCH_TIMEOUT_MS = 15_000;
const MAX_AGENDA_REDIRECTS = 5;
const MAX_GEOMETRY_BYTES = 256 * 1024;
const MAX_GEOMETRY_DEPTH = 6;

const agendaNumberOrder = (value: string | null): number | null => {
  if (!value) return null;
  const arabic = /^(\d{1,3})([A-Za-z]?)$/.exec(value);
  if (arabic) {
    return (
      Number(arabic[1]) * 100 +
      (arabic[2] ? arabic[2].toUpperCase().charCodeAt(0) - 64 : 0)
    );
  }
  if (!/^[IVXLCDM]+$/i.test(value)) return null;
  const numerals: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  const symbols = value.toUpperCase().split('');
  const number = symbols.reduce((total, symbol, index) => {
    const current = numerals[symbol];
    return (
      total +
      (current < (numerals[symbols[index + 1]] ?? 0) ? -current : current)
    );
  }, 0);
  return number * 100;
};

const ZONING_KEYWORDS = [
  'zoning',
  'variance',
  'rezoning',
  'rezoned',
  'setback',
  'ordinance',
  'plat',
  'annexation',
  'annex',
  'conditional use',
  'special use',
  'site plan',
  'subdivision',
  'easement',
  'right-of-way',
  'floodplain',
  'historic',
  'parking',
  'density',
  'hearing',
];

const GEOJSON_TYPES = new Set([
  'Point',
  'LineString',
  'Polygon',
  'MultiPoint',
  'MultiLineString',
  'MultiPolygon',
  'GeometryCollection',
  'Feature',
  'FeatureCollection',
]);

type Position = [number, number];
type Bbox = [number, number, number, number];

const isPosition = (value: unknown): value is Position =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === 'number' &&
  Number.isFinite(value[0]) &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[1]);

const positionInBbox = (point: Position, bbox: Bbox): boolean =>
  point[0] >= bbox[0] &&
  point[0] <= bbox[2] &&
  point[1] >= bbox[1] &&
  point[1] <= bbox[3];

const segmentIntersectsBbox = (
  start: Position,
  end: Position,
  bbox: Bbox
): boolean => {
  let lower = 0;
  let upper = 1;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const p = [-dx, dx, -dy, dy];
  const q = [
    start[0] - bbox[0],
    bbox[2] - start[0],
    start[1] - bbox[1],
    bbox[3] - start[1],
  ];
  for (let edge = 0; edge < 4; edge += 1) {
    if (p[edge] === 0) {
      if (q[edge] < 0) return false;
      continue;
    }
    const ratio = q[edge] / p[edge];
    if (p[edge] < 0) lower = Math.max(lower, ratio);
    else upper = Math.min(upper, ratio);
    if (lower > upper) return false;
  }
  return true;
};

const lineIntersectsBbox = (line: unknown, bbox: Bbox): boolean => {
  if (!Array.isArray(line)) return false;
  const positions = line.filter(isPosition);
  if (positions.some((point) => positionInBbox(point, bbox))) return true;
  return positions.some(
    (point, index) =>
      index > 0 && segmentIntersectsBbox(positions[index - 1], point, bbox)
  );
};

const pointInRing = (point: Position, ring: Position[]): boolean => {
  let inside = false;
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current++
  ) {
    const a = ring[current];
    const b = ring[previous];
    if (segmentIntersectsBbox(a, b, [point[0], point[1], point[0], point[1]])) {
      return true;
    }
    const crosses =
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
};

const polygonIntersectsBbox = (polygon: unknown, bbox: Bbox): boolean => {
  if (!Array.isArray(polygon) || !Array.isArray(polygon[0])) return false;
  const rings = polygon.map((ring) =>
    Array.isArray(ring) ? ring.filter(isPosition) : []
  );
  if (!rings[0]?.length) return false;
  if (rings.some((ring) => lineIntersectsBbox(ring, bbox))) return true;

  const corners: Position[] = [
    [bbox[0], bbox[1]],
    [bbox[0], bbox[3]],
    [bbox[2], bbox[1]],
    [bbox[2], bbox[3]],
  ];
  return corners.some(
    (corner) =>
      pointInRing(corner, rings[0]) &&
      !rings.slice(1).some((hole) => pointInRing(corner, hole))
  );
};

const geometryIntersectsBbox = (geometry: unknown, bbox: Bbox): boolean => {
  if (geometry === null || typeof geometry !== 'object') return false;
  const value = geometry as Record<string, unknown>;
  switch (value['type']) {
    case 'Feature':
      return geometryIntersectsBbox(value['geometry'], bbox);
    case 'FeatureCollection':
      return (
        Array.isArray(value['features']) &&
        value['features'].some((feature) =>
          geometryIntersectsBbox(feature, bbox)
        )
      );
    case 'GeometryCollection':
      return (
        Array.isArray(value['geometries']) &&
        value['geometries'].some((child) => geometryIntersectsBbox(child, bbox))
      );
    case 'Point':
      return (
        isPosition(value['coordinates']) &&
        positionInBbox(value['coordinates'], bbox)
      );
    case 'MultiPoint':
      return (
        Array.isArray(value['coordinates']) &&
        value['coordinates'].some(
          (point) => isPosition(point) && positionInBbox(point, bbox)
        )
      );
    case 'LineString':
      return lineIntersectsBbox(value['coordinates'], bbox);
    case 'MultiLineString':
      return (
        Array.isArray(value['coordinates']) &&
        value['coordinates'].some((line) => lineIntersectsBbox(line, bbox))
      );
    case 'Polygon':
      return polygonIntersectsBbox(value['coordinates'], bbox);
    case 'MultiPolygon':
      return (
        Array.isArray(value['coordinates']) &&
        value['coordinates'].some((polygon) =>
          polygonIntersectsBbox(polygon, bbox)
        )
      );
    default:
      return false;
  }
};

export type CivicServiceOptions = {
  maxAgendaBytes?: number;
  agendaSources?: AgendaSourceConfig[];
  agendaPollIntervalMs?: number;
  agendaSourceMaxItems?: number;
  fetcher?: (
    url: string,
    init?: RequestInit
  ) => Promise<{
    ok: boolean;
    status?: number;
    headers: { get(name: string): string | null };
    body?: ReadableStream<Uint8Array> | null;
    arrayBuffer?(): Promise<ArrayBuffer>;
  }>;
};

export type AgendaSourceConfig = {
  id: string;
  url?: string;
  indexUrl?: string;
  meetingBody?: CivicMeetingBody | string;
  tenantId?: string;
  approvedHosts?: string[];
};

type AgendaMetadata = {
  meetingBody: string;
  meetingDate: string;
  title: string;
};

type ImportedAgenda = { agenda: CivicAgendaDto; changed: boolean };

@Injectable()
export class CivicService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CivicService.name);
  private readonly maxAgendaBytes: number;
  private readonly agendaSources: Map<string, AgendaSourceConfig>;
  private readonly fetcher: NonNullable<CivicServiceOptions['fetcher']>;
  private readonly agendaPollIntervalMs: number;
  private readonly agendaSourceMaxItems: number;
  private pollTimer?: ReturnType<typeof setInterval>;
  private activePoll?: Promise<{
    discovered: number;
    ingested: number;
    skipped: number;
  }>;

  constructor(
    @Inject('CIVIC_CONNECTION')
    private readonly dataSource: DataSource,
    @Optional() options?: CivicServiceOptions
  ) {
    this.maxAgendaBytes = options?.maxAgendaBytes ?? MAX_AGENDA_BYTES;
    this.agendaSources = new Map(
      (options?.agendaSources ?? []).map((source) => [source.id, source])
    );
    this.fetcher = options?.fetcher ?? ((url, init) => fetch(url, init));
    this.agendaPollIntervalMs = Math.max(
      60_000,
      options?.agendaPollIntervalMs ?? 6 * 60 * 60 * 1000
    );
    this.agendaSourceMaxItems = options?.agendaSourceMaxItems ?? 5;
  }

  onModuleInit(): void {
    if (![...this.agendaSources.values()].some((source) => source.indexUrl)) {
      return;
    }
    void this.pollConfiguredAgendaSources().catch((error) =>
      this.logger.error(`Initial agenda source poll failed: ${String(error)}`)
    );
    this.pollTimer = setInterval(() => {
      void this.pollConfiguredAgendaSources().catch((error) =>
        this.logger.error(
          `Scheduled agenda source poll failed: ${String(error)}`
        )
      );
    }, this.agendaPollIntervalMs);
    this.pollTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  async getAgendas(
    tenantId: string,
    options: { meetingBody?: string; search?: string; limit?: number } = {}
  ): Promise<CivicAgendaDto[]> {
    const tenant = this.requireTenantId(tenantId);
    const limit = this.normalizeLimit(options.limit);
    const needle = options.search?.trim().toLowerCase() || '';
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const rows = await this.agendas(manager).find({
          where: { tenantId: tenant },
          order: { meetingDate: 'DESC' },
        });
        const dtos: CivicAgendaDto[] = [];
        for (const row of rows) {
          if (options.meetingBody && row.meetingBody !== options.meetingBody) {
            continue;
          }
          const dto = await this.toAgendaDto(manager, row);
          if (
            needle &&
            !dto.title.toLowerCase().includes(needle) &&
            !dto.items.some(
              (item) =>
                item.title.toLowerCase().includes(needle) ||
                item.summary.toLowerCase().includes(needle)
            )
          ) {
            continue;
          }
          dtos.push(dto);
          if (dtos.length >= limit) {
            break;
          }
        }
        return dtos;
      }
    );
  }

  async ingestAgenda(
    tenantId: string,
    dto: IngestAgendaDto
  ): Promise<CivicAgendaDto> {
    const tenant = this.requireTenantId(tenantId);
    const input = await this.validateDto(IngestAgendaDto, dto ?? {});
    let bytes: Buffer;
    try {
      bytes = Buffer.from(input.fileBase64, 'base64');
    } catch {
      this.fail(400, 'Agenda bytes must be base64 encoded.');
    }
    if (bytes.length === 0 || bytes.length > this.maxAgendaBytes) {
      this.fail(400, 'Agenda bytes are empty or exceed the size limit.');
    }
    let text: string;
    try {
      text = await extractDocumentText({
        filename: input.fileName,
        mimeType: 'application/pdf',
        buffer: bytes,
      });
    } catch (error) {
      if (error instanceof DocumentExtractionError) {
        this.fail(400, `Agenda could not be read: ${error.message}`);
      }
      throw error;
    }
    const items = this.splitAgendaItems(text);
    if (items.length === 0) {
      this.fail(400, 'No numbered agenda items were found in the document.');
    }
    return (await this.persistAgendaItems(tenant, input, items, input.fileName))
      .agenda;
  }

  async importAgendaSource(
    tenantId: string,
    dto: ImportAgendaSourceDto
  ): Promise<CivicAgendaDto> {
    const tenant = this.requireTenantId(tenantId);
    const input = await this.validateDto(ImportAgendaSourceDto, dto ?? {});
    const source = this.agendaSources.get(input.sourceId);
    if (!source?.url) {
      this.fail(400, 'Agenda source is not configured.');
    }
    this.requireAllowedUrl(source.url, this.sourceHosts(source));
    const resource = await this.fetchResource(
      source.url,
      this.sourceHosts(source)
    );
    if (!resource.contentType.includes('application/pdf')) {
      this.fail(400, 'Configured agenda source did not return a PDF.');
    }
    const fileName =
      new URL(source.url).pathname.split('/').pop() || 'agenda.pdf';
    return (
      await this.ingestSourceDocument(
        tenant,
        input,
        resource.bytes,
        'application/pdf',
        fileName,
        input.sourceId
      )
    ).agenda;
  }

  async pollConfiguredAgendaSources(): Promise<{
    discovered: number;
    ingested: number;
    skipped: number;
  }> {
    if (this.activePoll) return this.activePoll;
    const poll = this.pollConfiguredAgendaSourcesOnce();
    this.activePoll = poll;
    try {
      return await poll;
    } finally {
      if (this.activePoll === poll) this.activePoll = undefined;
    }
  }

  private async pollConfiguredAgendaSourcesOnce(): Promise<{
    discovered: number;
    ingested: number;
    skipped: number;
  }> {
    const result = { discovered: 0, ingested: 0, skipped: 0 };
    for (const source of this.agendaSources.values()) {
      if (!source.indexUrl || !source.meetingBody || !source.tenantId?.trim()) {
        continue;
      }
      try {
        const allowedHosts = this.sourceHosts(source);
        this.requireAllowedUrl(source.indexUrl, allowedHosts);
        const index = await this.fetchResource(source.indexUrl, allowedHosts);
        if (!index.contentType.includes('text/html')) {
          throw new Error('Agenda source index did not return HTML.');
        }
        const entries = discoverAgendaLinks(
          index.bytes.toString('utf8'),
          source.indexUrl,
          source.meetingBody,
          this.agendaSourceMaxItems
        );
        result.discovered += entries.length;
        for (const entry of entries) {
          try {
            this.requireAllowedUrl(entry.url, allowedHosts);
            const document = await this.fetchResource(entry.url, allowedHosts);
            const isPdf = document.contentType.includes('application/pdf');
            const isHtml = document.contentType.includes('text/html');
            if (!isPdf && !isHtml) {
              throw new Error('Agenda link did not return PDF or HTML.');
            }
            const imported = await this.ingestSourceDocument(
              this.requireTenantId(source.tenantId),
              {
                meetingBody: source.meetingBody,
                meetingDate: entry.meetingDate,
                title: entry.title,
              },
              document.bytes,
              document.contentType,
              new URL(entry.url).pathname.split('/').pop() ||
                (isPdf ? 'agenda.pdf' : 'agenda.html'),
              source.id
            );
            if (imported.changed) result.ingested += 1;
            else result.skipped += 1;
          } catch (error) {
            result.skipped += 1;
            this.logger.warn(
              `Could not import agenda ${entry.url} for source ${
                source.id
              }: ${String(error)}`
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Could not poll agenda index ${source.indexUrl}: ${String(error)}`
        );
      }
    }
    return result;
  }

  async getTipProjects(
    tenantId: string,
    options: { bbox?: [number, number, number, number]; limit?: number } = {}
  ): Promise<TipProjectSpatialDto[]> {
    const tenant = this.requireTenantId(tenantId);
    const limit = this.normalizeLimit(options.limit);
    if (options.bbox !== undefined) {
      this.requireBbox(options.bbox);
    }
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const rows = await this.tipProjects(manager).find({
          where: { tenantId: tenant },
          order: { createdAt: 'ASC' },
        });
        const dtos = rows.map((row) => this.toTipProjectDto(row));
        if (!options.bbox) {
          return dtos.slice(0, limit);
        }
        return dtos
          .filter((dto) =>
            this.geometryIntersectsBbox(
              dto.geometry,
              options.bbox as [number, number, number, number]
            )
          )
          .slice(0, limit);
      }
    );
  }

  async getTipProject(
    tenantId: string,
    id: string
  ): Promise<TipProjectSpatialDto> {
    const tenant = this.requireTenantId(tenantId);
    const projectId = this.requireUuid(id, 'tipProjectId');
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const row = await this.tipProjects(manager).findOne({
          where: { tenantId: tenant, id: projectId },
        });
        if (!row) {
          this.fail(404, 'TIP project not found for this tenant.');
        }
        return this.toTipProjectDto(row);
      }
    );
  }

  async registerTipProject(
    tenantId: string,
    dto: RegisterTipProjectDto
  ): Promise<TipProjectSpatialDto> {
    const tenant = this.requireTenantId(tenantId);
    const input = await this.validateDto(RegisterTipProjectDto, dto ?? {});
    this.requireGeometry(input.geometry);
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const saved = await this.tipProjects(manager).save(
          this.tipProjects(manager).create({
            tenantId: tenant,
            name: input.name.trim(),
            description: input.description.trim(),
            geometry: input.geometry,
            fundingAllocatedCents: input.fundingAllocatedCents,
            fundingSpentCents: input.fundingSpentCents ?? 0,
            status: input.status.trim(),
            milestone: input.milestone?.trim() || null,
          })
        );
        return this.toTipProjectDto(saved);
      }
    );
  }

  async publishBroadcast(
    tenantId: string,
    dto: PublishBroadcastDto
  ): Promise<EmergencyBroadcastDto> {
    const tenant = this.requireTenantId(tenantId);
    const input = await this.validateDto(PublishBroadcastDto, dto ?? {});
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const saved = await this.broadcasts(manager).save(
          this.broadcasts(manager).create({
            tenantId: tenant,
            severity: input.severity,
            headline: input.headline.trim(),
            body: input.body.trim(),
            issuedAt: new Date(),
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            audience: input.audience?.trim() || null,
          })
        );
        this.logger.log(
          `Broadcast ${saved.id} published for tenant ${tenant}.`
        );
        return this.toBroadcastDto(saved);
      }
    );
  }

  async getBroadcasts(
    tenantId: string,
    options: { since?: string; limit?: number } = {}
  ): Promise<EmergencyBroadcastDto[]> {
    const tenant = this.requireTenantId(tenantId);
    const limit = this.normalizeLimit(options.limit);
    const since = options.since ? new Date(options.since).getTime() : 0;
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const rows = await this.broadcasts(manager).find({
          where: { tenantId: tenant },
          order: { issuedAt: 'DESC' },
          take: limit,
        });
        const now = Date.now();
        return rows
          .filter(
            (row) =>
              (!row.expiresAt || row.expiresAt.getTime() > now) &&
              new Date(row.issuedAt).getTime() >
                (Number.isFinite(since) ? since : 0)
          )
          .map((row) => this.toBroadcastDto(row));
      }
    );
  }

  private agendas(manager: TenantRlsTransactionManager) {
    return (manager as unknown as EntityManager).getRepository(CivicAgenda);
  }

  private async fetchResource(
    url: string,
    allowedHosts: string[]
  ): Promise<{
    contentType: string;
    bytes: Buffer;
  }> {
    let response;
    let currentUrl = url;
    const signal = AbortSignal.timeout(AGENDA_FETCH_TIMEOUT_MS);
    for (let redirects = 0; ; redirects += 1) {
      this.requireAllowedUrl(currentUrl, allowedHosts);
      try {
        response = await this.fetcher(currentUrl, {
          redirect: 'manual',
          signal,
        });
      } catch {
        this.fail(503, 'Configured agenda source could not be reached.');
      }
      if (response.status && response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirects >= MAX_AGENDA_REDIRECTS) {
          this.fail(503, 'Agenda source returned an unsupported redirect.');
        }
        try {
          currentUrl = new URL(location, currentUrl).toString();
        } catch {
          this.fail(503, 'Agenda source returned an invalid redirect.');
        }
        continue;
      }
      break;
    }
    if (!response.ok) {
      this.fail(503, `Agenda source returned HTTP ${response.status ?? 0}.`);
    }
    const contentType =
      response.headers
        .get('content-type')
        ?.split(';')[0]
        .trim()
        .toLowerCase() ?? '';
    const declaredSize = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > this.maxAgendaBytes) {
      this.fail(400, 'Agenda document exceeds the size limit.');
    }
    let bytes: Buffer;
    if (response.body) {
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > this.maxAgendaBytes) {
            await reader.cancel();
            this.fail(400, 'Agenda document exceeds the size limit.');
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
      bytes = Buffer.concat(chunks, total);
    } else if (response.arrayBuffer) {
      // Native fetch responses provide a stream. Keep this fallback for
      // lightweight test adapters and cap the result immediately after read.
      bytes = Buffer.from(await response.arrayBuffer());
    } else {
      this.fail(503, 'Agenda source returned no readable response body.');
    }
    if (bytes.length === 0 || bytes.length > this.maxAgendaBytes) {
      this.fail(400, 'Agenda bytes are empty or exceed the size limit.');
    }
    return { contentType, bytes };
  }

  private sourceHosts(source: AgendaSourceConfig): string[] {
    const configured = source.approvedHosts ?? [];
    const indexHost = source.indexUrl ? new URL(source.indexUrl).hostname : '';
    const directHost = source.url ? new URL(source.url).hostname : '';
    return [
      ...new Set(
        [...configured, indexHost, directHost]
          .filter(Boolean)
          .map((host) => host.toLowerCase())
      ),
    ];
  }

  private requireAllowedUrl(value: string, allowedHosts: string[]): void {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      this.fail(503, 'Configured agenda source URL is invalid.');
    }
    const hostname = url!.hostname.toLowerCase();
    if (
      url!.protocol !== 'https:' ||
      !allowedHosts.includes(hostname) ||
      this.isUnsafeHostname(hostname)
    ) {
      this.fail(
        503,
        'Agenda source URL must use HTTPS on an approved public host.'
      );
    }
  }

  private isUnsafeHostname(hostname: string): boolean {
    const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      normalized === 'localhost' ||
      normalized.endsWith('.localhost') ||
      normalized.endsWith('.local') ||
      normalized.endsWith('.internal')
    ) {
      return true;
    }
    const version = isIP(normalized);
    if (version === 4) {
      const [a, b] = normalized.split('.').map(Number);
      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
      );
    }
    if (version === 6) {
      return (
        normalized === '::' ||
        normalized === '::1' ||
        /^(?:fc|fd|fe80:)/i.test(normalized) ||
        /^::ffff:(?:0:)?(?:10\.|127\.|169\.254\.|192\.168\.)/i.test(normalized)
      );
    }
    return false;
  }

  private async ingestSourceDocument(
    tenantId: string,
    metadata: AgendaMetadata,
    bytes: Buffer,
    contentType: string,
    fileName: string,
    sourceId: string
  ): Promise<ImportedAgenda> {
    let text: string;
    if (contentType.includes('text/html')) {
      text = agendaHtmlToText(bytes.toString('utf8'));
    } else {
      try {
        text = await extractDocumentText({
          filename: fileName,
          mimeType: 'application/pdf',
          buffer: bytes,
        });
      } catch (error) {
        if (error instanceof DocumentExtractionError) {
          this.fail(400, `Agenda could not be read: ${error.message}`);
        }
        throw error;
      }
    }
    const items = this.splitAgendaItems(text);
    if (items.length === 0) {
      this.fail(400, 'No numbered agenda items were found in the document.');
    }
    const identity = [
      sourceId,
      metadata.meetingBody,
      new Date(metadata.meetingDate).toISOString().slice(0, 10),
      metadata.title.trim().toLowerCase(),
    ].join(':');
    const identityHash = createHash('sha256').update(identity).digest('hex');
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    return this.persistAgendaItems(
      this.requireTenantId(tenantId),
      metadata,
      items,
      fileName,
      { identityHash, contentHash }
    );
  }

  private async persistAgendaItems(
    tenantId: string,
    metadata: AgendaMetadata,
    items: Array<{ itemNumber: string | null; title: string; body: string }>,
    fileName: string,
    source?: { identityHash: string; contentHash: string }
  ): Promise<ImportedAgenda> {
    const marker = source
      ? `source:${source.identityHash}:${source.contentHash}`
      : fileName.trim();
    return withTenantRlsTransaction(
      this.dataSource,
      tenantId,
      async (manager) => {
        let agenda: CivicAgenda | undefined;
        if (source) {
          await manager.queryRunner!.query(
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            [`civic-agenda:${tenantId}:${source.identityHash}`]
          );
          const rows = await this.agendas(manager).find({
            where: { tenantId },
          });
          agenda = rows.find((row) =>
            row.sourceFileName?.startsWith(`source:${source.identityHash}:`)
          );
          if (agenda?.sourceFileName === marker) {
            return {
              agenda: await this.toAgendaDto(manager, agenda),
              changed: false,
            };
          }
          if (agenda) {
            await this.agendaItems(manager).delete({
              tenantId,
              agendaId: agenda.id,
            });
            agenda.meetingBody = metadata.meetingBody;
            agenda.meetingDate = new Date(metadata.meetingDate);
            agenda.title = metadata.title.trim();
            agenda.sourceFileName = marker;
            agenda = await this.agendas(manager).save(agenda);
          }
        }
        if (!agenda) {
          agenda = await this.agendas(manager).save(
            this.agendas(manager).create({
              tenantId,
              meetingBody: metadata.meetingBody,
              meetingDate: new Date(metadata.meetingDate),
              title: metadata.title.trim(),
              sourceFileName: marker,
            })
          );
        }
        for (const [position, item] of items.entries()) {
          await this.agendaItems(manager).save(
            this.agendaItems(manager).create({
              tenantId,
              agendaId: agenda.id,
              itemNumber: item.itemNumber,
              position,
              title: item.title,
              summary: this.extractiveSummary(item.body),
              pageRef: null,
            })
          );
        }
        this.logger.log(
          `Ingested agenda ${agenda.id} with ${items.length} items for tenant ${tenantId}.`
        );
        return {
          agenda: await this.toAgendaDto(manager, agenda),
          changed: true,
        };
      }
    );
  }

  private agendaItems(manager: TenantRlsTransactionManager) {
    return (manager as unknown as EntityManager).getRepository(CivicAgendaItem);
  }

  private tipProjects(manager: TenantRlsTransactionManager) {
    return (manager as unknown as EntityManager).getRepository(TipProject);
  }

  private broadcasts(manager: TenantRlsTransactionManager) {
    return (manager as unknown as EntityManager).getRepository(
      EmergencyBroadcast
    );
  }

  private async toAgendaDto(
    manager: TenantRlsTransactionManager,
    row: CivicAgenda
  ): Promise<CivicAgendaDto> {
    const items = await this.agendaItems(manager).find({
      where: { agendaId: row.id },
      order: { position: 'ASC' },
    });
    return {
      id: row.id,
      meetingBody: row.meetingBody as CivicAgendaDto['meetingBody'],
      meetingDate: new Date(row.meetingDate).toISOString(),
      title: row.title,
      items: items.map((item) => ({
        id: item.id,
        agendaId: item.agendaId,
        ...(item.itemNumber ? { itemNumber: item.itemNumber } : {}),
        title: item.title,
        summary: item.summary,
        ...(item.pageRef !== null ? { pageRef: item.pageRef } : {}),
      })),
    };
  }

  private toTipProjectDto(row: TipProject): TipProjectSpatialDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      geometry: { ...(row.geometry as Record<string, unknown>) },
      fundingAllocatedCents: Number(row.fundingAllocatedCents),
      fundingSpentCents: Number(row.fundingSpentCents),
      status: row.status,
      ...(row.milestone ? { milestone: row.milestone } : {}),
    };
  }

  private toBroadcastDto(row: EmergencyBroadcast): EmergencyBroadcastDto {
    return {
      id: row.id,
      severity: row.severity as EmergencyBroadcastDto['severity'],
      headline: row.headline,
      body: row.body,
      issuedAt: new Date(row.issuedAt).toISOString(),
      ...(row.expiresAt
        ? { expiresAt: new Date(row.expiresAt).toISOString() }
        : {}),
      ...(row.audience ? { audience: row.audience } : {}),
    };
  }

  private splitAgendaItems(
    text: string
  ): Array<{ itemNumber: string | null; title: string; body: string }> {
    const lines = text.split('\n').map((line) => line.trim());
    const items: Array<{
      itemNumber: string | null;
      title: string;
      body: string;
    }> = [];
    let current: {
      itemNumber: string | null;
      title: string;
      body: string[];
    } | null = null;
    const flush = (): void => {
      if (current && current.title) {
        items.push({
          itemNumber: current.itemNumber,
          title: current.title,
          body: current.body.join(' '),
        });
      }
      current = null;
    };
    for (const line of lines) {
      if (!line) {
        continue;
      }
      const match =
        /^(?:item\s*)?(\d{1,3}[A-Za-z]?|[IVXLCDM]{1,7})\s*[.:)\-–—]\s+(.+)$/i.exec(
          line
        );
      if (match && match[2].length >= 3) {
        flush();
        current = {
          itemNumber: match[1],
          title: match[2].slice(0, 500),
          body: [],
        };
        continue;
      }
      if (current) {
        current.body.push(line);
      }
    }
    flush();
    if (items.every((item) => agendaNumberOrder(item.itemNumber) !== null)) {
      items.sort(
        (left, right) =>
          agendaNumberOrder(left.itemNumber)! -
          agendaNumberOrder(right.itemNumber)!
      );
    }
    return items;
  }

  extractiveSummary(body: string): string {
    const sentences = body
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 20);
    if (sentences.length === 0) {
      return body.slice(0, 500);
    }
    const scored = sentences.map((sentence, index) => {
      const lowered = sentence.toLowerCase();
      let score = sentences.length - index;
      for (const keyword of ZONING_KEYWORDS) {
        if (lowered.includes(keyword)) {
          score += 5;
        }
      }
      return { sentence, score, index };
    });
    const picked = scored
      .sort(
        (left, right) => right.score - left.score || left.index - right.index
      )
      .slice(0, 2)
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.sentence);
    return picked.join(' ').slice(0, 2000);
  }

  private requireGeometry(geometry: unknown): void {
    if (!geometry || typeof geometry !== 'object' || Array.isArray(geometry)) {
      this.fail(400, 'A GeoJSON geometry object is required.');
    }
    const record = geometry as Record<string, unknown>;
    if (
      typeof record['type'] !== 'string' ||
      !GEOJSON_TYPES.has(record['type'])
    ) {
      this.fail(400, 'A supported GeoJSON type is required.');
    }
    const serialized = JSON.stringify(record);
    if (serialized.length > MAX_GEOMETRY_BYTES) {
      this.fail(400, 'TIP geometry exceeds the size limit.');
    }
    if (!this.coordinatesFinite(record, 0)) {
      this.fail(400, 'TIP geometry coordinates must be finite numbers.');
    }
  }

  private coordinatesFinite(value: unknown, depth: number): boolean {
    if (depth > MAX_GEOMETRY_DEPTH) {
      return false;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    if (typeof value === 'string') {
      return true;
    }
    if (Array.isArray(value)) {
      return value.every((entry) => this.coordinatesFinite(entry, depth + 1));
    }
    if (value !== null && typeof value === 'object') {
      return Object.entries(value).every(
        ([key, entry]) =>
          key === 'bbox' ||
          (typeof key === 'string' && this.coordinatesFinite(entry, depth + 1))
      );
    }
    return false;
  }

  private requireBbox(
    bbox: unknown
  ): asserts bbox is [number, number, number, number] {
    if (
      !Array.isArray(bbox) ||
      bbox.length !== 4 ||
      !bbox.every(
        (value) => typeof value === 'number' && Number.isFinite(value)
      )
    ) {
      this.fail(400, 'A bbox of four finite numbers is required.');
    }
    const [minLng, minLat, maxLng, maxLat] = bbox as number[];
    if (minLng > maxLng || minLat > maxLat) {
      this.fail(400, 'A bbox needs min values at or below max values.');
    }
  }

  private geometryIntersectsBbox(
    geometry: Record<string, unknown>,
    bbox: [number, number, number, number]
  ): boolean {
    return geometryIntersectsBbox(geometry, bbox);
  }

  private normalizeLimit(limit: unknown): number {
    if (limit === undefined) {
      return 100;
    }
    const parsed = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    if (!Number.isSafeInteger(parsed) || (parsed as number) < 1) {
      return 100;
    }
    return Math.min(parsed as number, 500);
  }

  private requireTenantId(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      this.fail(401, 'Tenant context is required.');
    }
    try {
      return sanitizeTenantId(value);
    } catch {
      this.fail(401, 'Tenant context is invalid.');
    }
  }

  private requireUuid(value: unknown, name: string): string {
    if (
      typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value
      )
    ) {
      this.fail(400, `A valid ${name} is required.`);
    }
    return value as string;
  }

  private async validateDto<T extends object>(
    type: new () => T,
    value: unknown
  ): Promise<T> {
    const instance = plainToInstance(type, value);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      this.fail(400, 'Invalid civic payload.');
    }
    return instance;
  }

  private fail(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    message: string
  ): never {
    throw new RpcException({ statusCode: status, message });
  }
}
