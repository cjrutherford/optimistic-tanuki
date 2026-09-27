import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  sanitizeTenantId,
  TenantRlsTransactionManager,
  withTenantRlsTransaction,
} from '@optimistic-tanuki/business-security';
import {
  assertCoiStreamable,
  EnvelopeEncryptionService,
  extractExifGps,
  MAX_PHOTO_BYTES,
  sha256Hex,
  VirusScanService,
} from '@optimistic-tanuki/storage';
import {
  ChangeOrderResponseDto,
  ChangeOrderSubmissionDto,
  CreateMilestoneDto,
  DrawingManifestDto,
  InspectionPhotoResponseDto,
  InspectionPhotoUploadDto,
  NexusChangeOrderStatus,
  NexusMilestoneStatus,
  ProjectMilestoneDto,
  RegisterDrawingDto,
  UpdateMilestoneDto,
} from '@optimistic-tanuki/models';
import { NexusMilestone } from '../entities/nexus-milestone.entity';
import { NexusDrawing } from '../entities/nexus-drawing.entity';
import { NexusInspectionPhoto } from '../entities/nexus-inspection-photo.entity';
import { NexusChangeOrder } from '../entities/nexus-change-order.entity';

export const NEXUS_CHANGE_ORDER_TRANSITIONS: Record<string, string[]> = {
  [NexusChangeOrderStatus.DRAFT]: [NexusChangeOrderStatus.SUBMITTED],
  [NexusChangeOrderStatus.SUBMITTED]: [
    NexusChangeOrderStatus.APPROVED,
    NexusChangeOrderStatus.REJECTED,
  ],
  [NexusChangeOrderStatus.APPROVED]: [NexusChangeOrderStatus.APPLIED],
  [NexusChangeOrderStatus.REJECTED]: [],
  [NexusChangeOrderStatus.APPLIED]: [],
};

export type NexusServiceOptions = {
  virusScanner?: Pick<VirusScanService, 'scanFile'>;
  envelopeEncryption?: Pick<EnvelopeEncryptionService, 'encrypt' | 'decrypt'>;
  photoStoragePath?: string;
};

@Injectable()
export class NexusService {
  private readonly logger = new Logger(NexusService.name);
  private readonly photoStoragePath: string;
  private readonly envelopeEncryption: Pick<
    EnvelopeEncryptionService,
    'encrypt' | 'decrypt'
  >;
  private readonly virusScanner: Pick<VirusScanService, 'scanFile'>;

  constructor(
    @Inject('PROJECT_PLANNING_CONNECTION')
    private readonly dataSource: DataSource,
    @Optional() options?: NexusServiceOptions
  ) {
    this.photoStoragePath =
      options?.photoStoragePath ??
      process.env['NEXUS_PHOTO_STORAGE_PATH']?.trim() ??
      '/var/lib/optimistic-tanuki/nexus-photos';
    if (!this.photoStoragePath) {
      this.photoStoragePath = '/var/lib/optimistic-tanuki/nexus-photos';
    }
    this.envelopeEncryption =
      options?.envelopeEncryption ?? new EnvelopeEncryptionService();
    this.virusScanner = options?.virusScanner ?? new VirusScanService();
  }

  async createMilestone(
    tenantId: string,
    projectId: string,
    dto: CreateMilestoneDto
  ): Promise<ProjectMilestoneDto> {
    const tenant = this.requireTenantId(tenantId);
    const project = this.requireUuid(projectId, 'projectId');
    const input = await this.validateDto(CreateMilestoneDto, dto ?? {});
    const predecessors = [...(input.predecessorIds ?? [])];
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const repository = this.milestones(manager);
        if (predecessors.length > 0) {
          const siblings = await repository.find({
            where: { tenantId: tenant, projectId: project },
          });
          const knownIds = new Set(siblings.map((sibling) => sibling.id));
          for (const predecessorId of predecessors) {
            if (!knownIds.has(predecessorId)) {
              this.fail(
                400,
                'A predecessor milestone does not exist in this project.'
              );
            }
          }
        }
        const row = repository.create({
          tenantId: tenant,
          projectId: project,
          phase: input.phase.trim(),
          status: NexusMilestoneStatus.PLANNED,
          plannedStart: new Date(input.plannedStart),
          plannedEnd: new Date(input.plannedEnd),
          actualStart: null,
          actualEnd: null,
          progressPercent: 0,
          predecessorIds: predecessors,
          notes: null,
        });
        const saved = await repository.save(row);
        return this.toMilestoneDto(saved);
      }
    );
  }

  async registerDrawing(
    tenantId: string,
    projectId: string,
    dto: RegisterDrawingDto
  ): Promise<DrawingManifestDto> {
    const tenant = this.requireTenantId(tenantId);
    const project = this.requireUuid(projectId, 'projectId');
    const input = await this.validateDto(RegisterDrawingDto, dto ?? {});
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const saved = await this.drawings(manager).save(
          this.drawings(manager).create({
            tenantId: tenant,
            projectId: project,
            title: input.title.trim(),
            version: input.version.trim(),
            storageKey: input.storageKey.trim(),
            sha256: input.sha256.toLowerCase(),
            coiStatus: 'unverified',
            coiExpiresAt: input.coiExpiresAt
              ? new Date(input.coiExpiresAt)
              : null,
          })
        );
        void saved;
        return this.readDrawingManifest(manager, tenant, project);
      }
    );
  }

  async getMilestones(
    tenantId: string,
    projectId: string
  ): Promise<ProjectMilestoneDto[]> {
    const tenant = this.requireTenantId(tenantId);
    const project = this.requireUuid(projectId, 'projectId');
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const rows = await this.milestones(manager).find({
          where: { tenantId: tenant, projectId: project },
          order: { plannedStart: 'ASC' },
        });
        return rows.map((row) => this.toMilestoneDto(row));
      }
    );
  }

  async updateMilestone(
    tenantId: string,
    id: string,
    dto: UpdateMilestoneDto
  ): Promise<ProjectMilestoneDto> {
    const tenant = this.requireTenantId(tenantId);
    const milestoneId = this.requireUuid(id, 'milestoneId');
    const patch = await this.validateDto(UpdateMilestoneDto, dto ?? {});
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const repository = this.milestones(manager);
        const row = await repository.findOne({
          where: { tenantId: tenant, id: milestoneId },
        });
        if (!row) {
          this.fail(404, 'Milestone not found for this project and tenant.');
        }
        if (patch.status !== undefined) {
          row.status = patch.status;
        }
        if (patch.progressPercent !== undefined) {
          row.progressPercent = patch.progressPercent;
        }
        if (patch.actualStart !== undefined) {
          row.actualStart = new Date(patch.actualStart);
        }
        if (patch.actualEnd !== undefined) {
          row.actualEnd = new Date(patch.actualEnd);
        }
        if (patch.notes !== undefined) {
          row.notes = patch.notes || null;
        }
        if (row.progressPercent === 100) {
          row.status = NexusMilestoneStatus.COMPLETED;
          if (!row.actualEnd) {
            row.actualEnd = new Date();
          }
        }
        await repository.save(row);
        return this.toMilestoneDto(row);
      }
    );
  }

  async setMilestonePredecessors(
    tenantId: string,
    id: string,
    predecessorIds: string[]
  ): Promise<ProjectMilestoneDto> {
    const tenant = this.requireTenantId(tenantId);
    const milestoneId = this.requireUuid(id, 'milestoneId');
    const predecessors = Array.isArray(predecessorIds) ? predecessorIds : [];
    for (const predecessorId of predecessors) {
      this.requireUuid(predecessorId, 'predecessorId');
    }
    if (predecessors.includes(milestoneId)) {
      this.fail(400, 'A milestone cannot depend on itself.');
    }
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const repository = this.milestones(manager);
        const row = await repository.findOne({
          where: { tenantId: tenant, id: milestoneId },
        });
        if (!row) {
          this.fail(404, 'Milestone not found for this project and tenant.');
        }
        const siblings = await repository.find({
          where: { tenantId: tenant, projectId: row.projectId },
        });
        const knownIds = new Set(siblings.map((sibling) => sibling.id));
        for (const predecessorId of predecessors) {
          if (!knownIds.has(predecessorId)) {
            this.fail(
              400,
              'A predecessor milestone does not exist in this project.'
            );
          }
        }
        const graph = new Map<string, string[]>();
        for (const sibling of siblings) {
          graph.set(
            sibling.id,
            sibling.id === milestoneId
              ? [...predecessors]
              : [...sibling.predecessorIds]
          );
        }
        if (this.hasCycle(graph)) {
          this.fail(400, 'Milestone dependencies must not form a cycle.');
        }
        row.predecessorIds = [...predecessors];
        await repository.save(row);
        return this.toMilestoneDto(row);
      }
    );
  }

  async getDrawings(
    tenantId: string,
    projectId: string
  ): Promise<DrawingManifestDto> {
    const tenant = this.requireTenantId(tenantId);
    const project = this.requireUuid(projectId, 'projectId');
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        return this.readDrawingManifest(manager, tenant, project);
      }
    );
  }

  async uploadInspectionPhoto(
    tenantId: string,
    dto: InspectionPhotoUploadDto
  ): Promise<InspectionPhotoResponseDto> {
    const tenant = this.requireTenantId(tenantId);
    const upload = await this.validateDto(InspectionPhotoUploadDto, dto ?? {});
    const project = this.requireUuid(upload.projectId, 'projectId');
    const fileName = upload.fileName.trim();
    if (!fileName || fileName.length > 255 || /[\\/]/.test(fileName)) {
      this.fail(400, 'A safe file name is required.');
    }
    let bytes: Buffer;
    try {
      bytes = Buffer.from(upload.fileBase64, 'base64');
    } catch {
      this.fail(400, 'Photo bytes must be base64 encoded.');
    }
    if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
      this.fail(400, 'Photo bytes are empty or exceed the size limit.');
    }
    const scan = await this.scanPhoto(bytes, fileName);
    const digest = sha256Hex(bytes);
    const gps = extractExifGps(bytes);
    const storageKey = `${tenant}/${project}/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
    await this.storePhotoBytes(storageKey, bytes);
    return this.recordInspectionPhoto({
      tenantId: tenant,
      projectId: project,
      fileName,
      storageKey,
      sha256: digest,
      gpsLatitude: gps?.latitude ?? null,
      gpsLongitude: gps?.longitude ?? null,
      antivirusStatus: scan,
      capturedAt: upload.capturedAt ?? new Date().toISOString(),
    });
  }

  async assertDrawingStreamable(
    tenantId: string,
    drawingId: string
  ): Promise<{ storageKey: string; sha256: string }> {
    const tenant = this.requireTenantId(tenantId);
    const id = this.requireUuid(drawingId, 'drawingId');
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const row = await this.drawings(manager).findOne({
          where: { tenantId: tenant, id },
        });
        if (!row) {
          this.fail(404, 'Drawing not found for this project and tenant.');
        }
        try {
          assertCoiStreamable({
            coiStatus: row.coiStatus,
            coiExpiresAt: row.coiExpiresAt,
          });
        } catch (error) {
          this.fail(
            403,
            error instanceof Error
              ? error.message
              : 'Drawing is not streamable.'
          );
        }
        return { storageKey: row.storageKey, sha256: row.sha256 };
      }
    );
  }

  async recordInspectionPhoto(input: {
    tenantId: string;
    projectId: string;
    fileName: string;
    storageKey: string;
    sha256: string;
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    antivirusStatus: string;
    capturedAt: string;
  }): Promise<InspectionPhotoResponseDto> {
    const tenant = this.requireTenantId(input?.tenantId);
    const project = this.requireUuid(input?.projectId, 'projectId');
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const row = this.photos(manager).create({
          tenantId: tenant,
          projectId: project,
          fileName: String(input.fileName),
          storageKey: String(input.storageKey),
          sha256: String(input.sha256),
          gpsLatitude: input.gpsLatitude,
          gpsLongitude: input.gpsLongitude,
          antivirusStatus: String(input.antivirusStatus || 'not_scanned'),
          capturedAt: new Date(input.capturedAt),
        });
        const saved = await this.photos(manager).save(row);
        return this.toPhotoDto(saved);
      }
    );
  }

  async submitChangeOrder(
    tenantId: string,
    dto: ChangeOrderSubmissionDto
  ): Promise<ChangeOrderResponseDto> {
    const tenant = this.requireTenantId(tenantId);
    const submission = await this.validateDto(
      ChangeOrderSubmissionDto,
      dto ?? {}
    );
    const project = this.requireUuid(submission.projectId, 'projectId');
    this.requireSignatures(submission.signatures);
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const row = this.changeOrders(manager).create({
          tenantId: tenant,
          projectId: project,
          title: submission.title.trim(),
          description: submission.description.trim(),
          amountCents: submission.amountCents,
          status: NexusChangeOrderStatus.SUBMITTED,
          signatures: submission.signatures.map((signature) => ({
            name: signature.name.trim(),
            role: signature.role,
            signaturePng: signature.signaturePng,
            signedAt: signature.signedAt,
          })),
          documentKey: null,
        });
        const saved = await this.changeOrders(manager).save(row);
        this.logger.log(
          `Change order ${saved.id} submitted for project ${project}.`
        );
        return this.toChangeOrderDto(saved);
      }
    );
  }

  async transitionChangeOrder(
    tenantId: string,
    id: string,
    to: string
  ): Promise<ChangeOrderResponseDto> {
    const tenant = this.requireTenantId(tenantId);
    const orderId = this.requireUuid(id, 'changeOrderId');
    const target = String(to ?? '');
    const allowed = NEXUS_CHANGE_ORDER_TRANSITIONS;
    if (!Object.prototype.hasOwnProperty.call(allowed, target)) {
      this.fail(400, 'Unknown change order status.');
    }
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const repository = this.changeOrders(manager);
        const row = await repository.findOne({
          where: { tenantId: tenant, id: orderId },
        });
        if (!row) {
          this.fail(404, 'Change order not found for this project and tenant.');
        }
        if (!allowed[row.status].includes(target)) {
          this.fail(
            409,
            `Cannot move a ${row.status} change order to ${target}.`
          );
        }
        row.status = target;
        await repository.save(row);
        if (target === NexusChangeOrderStatus.APPROVED) {
          const documentKey = await this.buildChangeOrderDocument(tenant, row);
          row.documentKey = documentKey;
          await repository.save(row);
        }
        return this.toChangeOrderDto(row);
      }
    );
  }

  async getChangeOrders(
    tenantId: string,
    projectId: string
  ): Promise<ChangeOrderResponseDto[]> {
    const tenant = this.requireTenantId(tenantId);
    const project = this.requireUuid(projectId, 'projectId');
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const rows = await this.changeOrders(manager).find({
          where: { tenantId: tenant, projectId: project },
          order: { createdAt: 'ASC' },
        });
        return rows.map((row) => this.toChangeOrderDto(row));
      }
    );
  }

  async getChangeOrder(
    tenantId: string,
    id: string
  ): Promise<NexusChangeOrder> {
    const tenant = this.requireTenantId(tenantId);
    const orderId = this.requireUuid(id, 'changeOrderId');
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const row = await this.changeOrders(manager).findOne({
          where: { tenantId: tenant, id: orderId },
        });
        if (!row) {
          this.fail(404, 'Change order not found for this project and tenant.');
        }
        return row;
      }
    );
  }

  async setChangeOrderDocument(
    tenantId: string,
    id: string,
    documentKey: string
  ): Promise<void> {
    const tenant = this.requireTenantId(tenantId);
    const orderId = this.requireUuid(id, 'changeOrderId');
    await withTenantRlsTransaction(this.dataSource, tenant, async (manager) => {
      const repository = this.changeOrders(manager);
      const row = await repository.findOne({
        where: { tenantId: tenant, id: orderId },
      });
      if (!row) {
        this.fail(404, 'Change order not found for this project and tenant.');
      }
      row.documentKey = String(documentKey);
      await repository.save(row);
    });
  }

  private async buildChangeOrderDocument(
    tenantId: string,
    row: NexusChangeOrder
  ): Promise<string> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const page = document.addPage([612, 792]);
    const margin = 56;
    let cursor = 740;
    const line = (text: string, size = 11, gap = 18, useBold = false): void => {
      page.drawText(text.slice(0, 110), {
        x: margin,
        y: cursor,
        size,
        font: useBold ? bold : font,
        color: rgb(0.09, 0.11, 0.16),
      });
      cursor -= gap;
    };
    line('CHANGE ORDER SUMMARY', 18, 30, true);
    line(`Document: ${row.id}`);
    line(`Project: ${row.projectId}`);
    line(`Tenant: ${tenantId}`);
    line(`Title: ${row.title}`, 12, 20, true);
    for (const chunk of row.description.match(/.{1,95}/g) ?? []) {
      line(chunk);
    }
    cursor -= 6;
    line(
      `Amount: $${(Number(row.amountCents) / 100).toFixed(2)}`,
      12,
      20,
      true
    );
    line(`Status: ${row.status}`, 12, 24, true);
    line('SIGNATURES', 14, 26, true);
    for (const signature of row.signatures) {
      line(`${signature.role}: ${signature.name} (${signature.signedAt})`);
      try {
        const pngBytes = Buffer.from(
          signature.signaturePng.replace(/^data:image\/png;base64,/, ''),
          'base64'
        );
        if (pngBytes.length > 0 && pngBytes.length <= 1024 * 1024) {
          const image = await document.embedPng(pngBytes);
          const scale = Math.min(1, 180 / image.width, 60 / image.height);
          page.drawImage(image, {
            x: margin,
            y: cursor - 60 * scale,
            width: image.width * scale,
            height: image.height * scale,
          });
          cursor -= 60 * scale + 8;
        }
      } catch {
        line('(signature image unreadable; metadata retained above)');
      }
    }
    cursor -= 6;
    line(`Generated: ${new Date().toISOString()}`);
    line(`Reference: ${row.id}`);
    const pdf = Buffer.from(await document.save());
    const documentKey = `${tenantId}/${row.projectId}/change-orders/${row.id}.pdf`;
    const container = this.envelopeEncryption.encrypt(pdf);
    const absolutePath = path.join(this.photoStoragePath, documentKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const tempPath = `${absolutePath}.tmp-${process.pid}`;
    await fs.writeFile(tempPath, container, { mode: 0o600 });
    await fs.rename(tempPath, absolutePath);
    this.logger.log(`Sealed signed change order document for ${row.id}.`);
    return documentKey;
  }

  private async scanPhoto(bytes: Buffer, fileName: string): Promise<string> {
    try {
      const result = await this.virusScanner.scanFile(bytes, fileName);
      if (!result.isClean) {
        this.fail(400, 'Inspection photo was rejected by antivirus scan.');
      }
      return 'clean';
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      this.fail(
        503,
        error instanceof Error
          ? error.message
          : 'Antivirus scan is unavailable.'
      );
    }
  }

  private async storePhotoBytes(
    storageKey: string,
    bytes: Buffer
  ): Promise<void> {
    const container = this.envelopeEncryption.encrypt(bytes);
    const absolutePath = path.join(this.photoStoragePath, storageKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const tempPath = `${absolutePath}.tmp-${process.pid}`;
    await fs.writeFile(tempPath, container, { mode: 0o600 });
    await fs.rename(tempPath, absolutePath);
  }

  async getChangeOrderDocument(
    tenantId: string,
    id: string
  ): Promise<{
    fileName: string;
    mimeType: string;
    fileBase64: string;
    sha256: string;
  }> {
    const tenant = this.requireTenantId(tenantId);
    const orderId = this.requireUuid(id, 'changeOrderId');
    return withTenantRlsTransaction(
      this.dataSource,
      tenant,
      async (manager) => {
        const row = await this.changeOrders(manager).findOne({
          where: { tenantId: tenant, id: orderId },
        });
        if (!row) {
          this.fail(404, 'Change order not found for this project and tenant.');
        }
        if (!row.documentKey) {
          this.fail(
            409,
            'No signed document exists for this change order yet.'
          );
        }
        const absolutePath = path.join(this.photoStoragePath, row.documentKey);
        let container: Buffer;
        try {
          container = await fs.readFile(absolutePath);
        } catch {
          this.fail(503, 'Signed change order document is unavailable.');
        }
        let pdf: Buffer;
        try {
          pdf = this.envelopeEncryption.decrypt(container);
        } catch {
          this.fail(
            503,
            'Signed change order document failed integrity check.'
          );
        }
        return {
          fileName: `change-order-${row.id}.pdf`,
          mimeType: 'application/pdf',
          fileBase64: pdf.toString('base64'),
          sha256: sha256Hex(pdf),
        };
      }
    );
  }

  private milestones(manager: TenantRlsTransactionManager) {
    return (manager as unknown as EntityManager).getRepository(NexusMilestone);
  }

  private async readDrawingManifest(
    manager: TenantRlsTransactionManager,
    tenant: string,
    project: string
  ): Promise<DrawingManifestDto> {
    const rows = await this.drawings(manager).find({
      where: { tenantId: tenant, projectId: project },
      order: { createdAt: 'ASC' },
    });
    const now = Date.now();
    return {
      projectId: project,
      drawings: rows.map((row) => ({
        id: row.id,
        title: row.title,
        version: row.version,
        storageKey: row.storageKey,
        sha256: row.sha256,
        coiStatus:
          row.coiStatus === 'valid' &&
          row.coiExpiresAt &&
          row.coiExpiresAt.getTime() <= now
            ? 'expired'
            : row.coiStatus,
      })),
    };
  }

  private drawings(manager: TenantRlsTransactionManager) {
    return (manager as unknown as EntityManager).getRepository(NexusDrawing);
  }

  private photos(manager: TenantRlsTransactionManager) {
    return (manager as unknown as EntityManager).getRepository(
      NexusInspectionPhoto
    );
  }

  private changeOrders(manager: TenantRlsTransactionManager) {
    return (manager as unknown as EntityManager).getRepository(
      NexusChangeOrder
    );
  }

  private toMilestoneDto(row: NexusMilestone): ProjectMilestoneDto {
    const now = Date.now();
    const plannedEnd = new Date(row.plannedEnd).getTime();
    const overdue =
      (row.status === NexusMilestoneStatus.PLANNED ||
        row.status === NexusMilestoneStatus.IN_PROGRESS) &&
      Number.isFinite(plannedEnd) &&
      plannedEnd < now;
    const delayDays = overdue ? Math.floor((now - plannedEnd) / 86400000) : 0;
    return {
      id: row.id,
      projectId: row.projectId,
      phase: row.phase,
      status: row.status as ProjectMilestoneDto['status'],
      plannedStart: new Date(row.plannedStart).toISOString(),
      plannedEnd: new Date(row.plannedEnd).toISOString(),
      ...(row.actualStart
        ? { actualStart: new Date(row.actualStart).toISOString() }
        : {}),
      ...(row.actualEnd
        ? { actualEnd: new Date(row.actualEnd).toISOString() }
        : {}),
      progressPercent: row.progressPercent,
      predecessorIds: [...row.predecessorIds],
      delayDays,
      delayed: overdue,
    };
  }

  private toPhotoDto(row: NexusInspectionPhoto): InspectionPhotoResponseDto {
    return {
      id: row.id,
      projectId: row.projectId,
      fileName: row.fileName,
      sha256: row.sha256,
      ...(row.gpsLatitude !== null && row.gpsLongitude !== null
        ? { gps: { latitude: row.gpsLatitude, longitude: row.gpsLongitude } }
        : {}),
      antivirusStatus: row.antivirusStatus,
      capturedAt: new Date(row.capturedAt).toISOString(),
    };
  }

  private toChangeOrderDto(row: NexusChangeOrder): ChangeOrderResponseDto {
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      description: row.description,
      amountCents: Number(row.amountCents),
      status: row.status as ChangeOrderResponseDto['status'],
      signatures: row.signatures.map((signature) => ({ ...signature })),
      ...(row.documentKey ? { documentKey: row.documentKey } : {}),
    };
  }

  private hasCycle(graph: Map<string, string[]>): boolean {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (node: string): boolean => {
      if (visited.has(node)) {
        return false;
      }
      if (visiting.has(node)) {
        return true;
      }
      visiting.add(node);
      for (const next of graph.get(node) ?? []) {
        if (graph.has(next) && visit(next)) {
          return true;
        }
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };
    for (const node of graph.keys()) {
      if (visit(node)) {
        return true;
      }
    }
    return false;
  }

  private requireSignatures(
    signatures: ChangeOrderSubmissionDto['signatures']
  ): void {
    if (!Array.isArray(signatures) || signatures.length === 0) {
      this.fail(400, 'At least one signature is required.');
    }
    const roles = new Set(signatures.map((signature) => signature?.role));
    if (!roles.has('owner') || !roles.has('contractor')) {
      this.fail(400, 'Owner and contractor signatures are both required.');
    }
    for (const signature of signatures) {
      if (
        typeof signature?.signaturePng !== 'string' ||
        !signature.signaturePng.startsWith('data:image/png;base64,')
      ) {
        this.fail(400, 'Signatures must be PNG data URLs from the canvas.');
      }
    }
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
      this.fail(400, 'Invalid Nexus payload.');
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
