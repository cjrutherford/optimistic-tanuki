import { RpcException } from '@nestjs/microservices';
import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as storage from '@optimistic-tanuki/storage';

// uuid ships as ESM, which this project's jest transform does not parse.
jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

import { NexusService } from './nexus.service';
import { NexusMilestone } from '../entities/nexus-milestone.entity';
import { NexusDrawing } from '../entities/nexus-drawing.entity';
import { NexusInspectionPhoto } from '../entities/nexus-inspection-photo.entity';
import { NexusChangeOrder } from '../entities/nexus-change-order.entity';

type Stored = Record<string, unknown> & { id: string };

class TestRepository {
  readonly records: Stored[] = [];
  private sequence = 0;

  create(values: Record<string, unknown>): Stored {
    return { ...values } as Stored;
  }

  async findOne(options: {
    where: Record<string, unknown>;
  }): Promise<Stored | null> {
    return (
      this.records.find((record) =>
        Object.entries(options.where).every(
          ([key, value]) => record[key] === value
        )
      ) || null
    );
  }

  async find(options: {
    where: Record<string, unknown>;
    order?: Record<string, 'ASC' | 'DESC'>;
  }): Promise<Stored[]> {
    const matches = this.records.filter((record) =>
      Object.entries(options.where).every(
        ([key, value]) => record[key] === value
      )
    );
    const [orderKey, direction] = Object.entries(options.order ?? {})[0] ?? [];
    if (!orderKey) {
      return matches;
    }
    return [...matches].sort((left, right) => {
      const comparison = String(left[orderKey]).localeCompare(
        String(right[orderKey])
      );
      return direction === 'DESC' ? -comparison : comparison;
    });
  }

  async save(entity: Partial<Stored>): Promise<Stored> {
    const full = { ...entity } as Stored;
    if (!full.id) {
      this.sequence += 1;
      full.id = `00000000-0000-4000-8000-${String(this.sequence).padStart(
        12,
        '0'
      )}`;
    }
    const index = this.records.findIndex((record) => record.id === full.id);
    if (index < 0) {
      this.records.push(full);
    } else {
      this.records[index] = full;
    }
    return full;
  }
}

const repositories = new Map<string, TestRepository>();
const repositoryFor = (entity: { name: string }): TestRepository => {
  const existing = repositories.get(entity.name);
  if (existing) {
    return existing;
  }
  const created = new TestRepository();
  repositories.set(entity.name, created);
  return created;
};

const createDataSource = () => {
  const manager = {
    queryRunner: { isTransactionActive: true, query: async () => [] },
    getRepository: (entity: { name: string }) => repositoryFor(entity),
  };
  return {
    transaction: async <T>(callback: (value: typeof manager) => Promise<T>) =>
      callback(manager),
  } as never;
};

async function rpcError(promise: Promise<unknown>): Promise<{
  statusCode: number;
  message: string;
}> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RpcException);
    return (error as RpcException).getError() as {
      statusCode: number;
      message: string;
    };
  }
  throw new Error('Expected the call to fail.');
}

describe('NexusService', () => {
  let service: NexusService;
  const tenantId = 'nexus-builder';
  const projectId = '11111111-1111-4111-8111-111111111111';
  const previousKek = process.env['VAULT_STORAGE_KEK'];

  beforeEach(() => {
    repositories.clear();
    process.env['VAULT_STORAGE_KEK'] =
      'test-nexus-photo-kek-with-sufficient-entropy-01';
    process.env['NEXUS_PHOTO_STORAGE_PATH'] = path.join(
      os.tmpdir(),
      'nexus-service-default'
    );
    service = new NexusService(createDataSource());
  });

  afterEach(() => {
    if (previousKek === undefined) {
      delete process.env['VAULT_STORAGE_KEK'];
    } else {
      process.env['VAULT_STORAGE_KEK'] = previousKek;
    }
    delete process.env['NEXUS_PHOTO_STORAGE_PATH'];
  });

  const seedMilestone = async (overrides: Record<string, unknown> = {}) => {
    const repository = repositoryFor(NexusMilestone);
    const row = await repository.save({
      tenantId,
      projectId,
      phase: 'Foundation',
      status: 'planned',
      plannedStart: new Date('2026-01-05T08:00:00.000Z'),
      plannedEnd: new Date('2026-02-05T17:00:00.000Z'),
      actualStart: null,
      actualEnd: null,
      progressPercent: 0,
      predecessorIds: [],
      notes: null,
      ...overrides,
    });
    return row;
  };

  it('creates a milestone with validated predecessors', async () => {
    const first = await service.createMilestone(tenantId, projectId, {
      phase: 'Foundation',
      plannedStart: '2026-01-05T08:00:00.000Z',
      plannedEnd: '2026-02-05T17:00:00.000Z',
    });
    expect(first.status).toBe('planned');
    expect(first.progressPercent).toBe(0);

    const second = await service.createMilestone(tenantId, projectId, {
      phase: 'Framing',
      plannedStart: '2026-02-06T08:00:00.000Z',
      plannedEnd: '2026-03-06T17:00:00.000Z',
      predecessorIds: [first.id],
    });
    expect(second.predecessorIds).toEqual([first.id]);

    const unknown = await rpcError(
      service.createMilestone(tenantId, projectId, {
        phase: 'Roofing',
        plannedStart: '2026-03-07T08:00:00.000Z',
        plannedEnd: '2026-04-07T17:00:00.000Z',
        predecessorIds: ['44444444-4444-4433-8433-444444444444'],
      })
    );
    expect(unknown.statusCode).toBe(400);
  });

  it('registers a drawing as unverified pending COI review', async () => {
    const manifest = await service.registerDrawing(tenantId, projectId, {
      title: 'Foundation plan',
      version: 'C3',
      storageKey: 'drawings/plan-c3.pdf',
      sha256: 'e'.repeat(64),
    });

    expect(manifest.drawings).toHaveLength(1);
    expect(manifest.drawings[0]).toEqual(
      expect.objectContaining({ coiStatus: 'unverified', version: 'C3' })
    );
  });

  it('lists milestones with computed delay alerts', async () => {
    await seedMilestone({
      phase: 'Overdue phase',
      status: 'in_progress',
      plannedEnd: new Date('2020-01-01T00:00:00.000Z'),
    });
    await seedMilestone({
      phase: 'Future phase',
      plannedStart: new Date('2099-01-01T00:00:00.000Z'),
      plannedEnd: new Date('2099-02-01T00:00:00.000Z'),
    });

    const milestones = await service.getMilestones(tenantId, projectId);

    expect(milestones).toHaveLength(2);
    expect(milestones[0]).toEqual(
      expect.objectContaining({ delayed: true, delayDays: expect.any(Number) })
    );
    expect(milestones[0].delayDays).toBeGreaterThan(0);
    expect(milestones[1]).toEqual(
      expect.objectContaining({ delayed: false, delayDays: 0 })
    );
  });

  it('completes a milestone at one hundred percent progress', async () => {
    const row = await seedMilestone();

    const updated = await service.updateMilestone(tenantId, row.id, {
      progressPercent: 100,
    });

    expect(updated.status).toBe('completed');
    expect(updated.progressPercent).toBe(100);
    expect(updated.actualEnd).toBeDefined();
  });

  it('rejects self dependencies and dependency cycles', async () => {
    const first = await seedMilestone({ phase: 'First' });
    const second = await seedMilestone({ phase: 'Second' });
    await service.setMilestonePredecessors(tenantId, second.id, [first.id]);

    const self = await rpcError(
      service.setMilestonePredecessors(tenantId, first.id, [first.id])
    );
    expect(self.statusCode).toBe(400);

    const cycle = await rpcError(
      service.setMilestonePredecessors(tenantId, first.id, [second.id])
    );
    expect(cycle.statusCode).toBe(400);
  });

  it('rejects predecessors from another project', async () => {
    const row = await seedMilestone();
    const foreign = await seedMilestone({
      phase: 'Foreign',
      projectId: '22222222-2222-4222-8222-222222222222',
    });

    const result = await rpcError(
      service.setMilestonePredecessors(tenantId, row.id, [foreign.id])
    );
    expect(result.statusCode).toBe(400);
  });

  it('recomputes expired COI status on read', async () => {
    const repository = repositoryFor(NexusDrawing);
    await repository.save({
      tenantId,
      projectId,
      title: 'Foundation plan',
      version: 'C3',
      storageKey: 'drawings/plan-c3.pdf',
      sha256: 'a'.repeat(64),
      coiStatus: 'valid',
      coiExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });

    const manifest = await service.getDrawings(tenantId, projectId);

    expect(manifest.drawings).toHaveLength(1);
    expect(manifest.drawings[0].coiStatus).toBe('expired');
  });

  it('records inspection photo metadata', async () => {
    const photo = await service.recordInspectionPhoto({
      tenantId,
      projectId,
      fileName: ' footing-pour.jpg',
      storageKey: 'photos/footing-pour.jpg',
      sha256: 'b'.repeat(64),
      gpsLatitude: 31.123,
      gpsLongitude: -83.456,
      antivirusStatus: 'clean',
      capturedAt: '2026-03-01T10:00:00.000Z',
    });

    expect(photo.sha256).toBe('b'.repeat(64));
    expect(photo.gps).toEqual({ latitude: 31.123, longitude: -83.456 });
    expect(repositoryFor(NexusInspectionPhoto).records).toHaveLength(1);
  });

  it('submits a change order only with owner and contractor signatures', async () => {
    const signatures = [
      {
        name: 'Olivia Owner',
        role: 'owner',
        signaturePng: 'data:image/png;base64,c2lnbmF0dXJl',
        signedAt: '2026-03-02T10:00:00.000Z',
      },
      {
        name: 'Chris Contractor',
        role: 'contractor',
        signaturePng: 'data:image/png;base64,c2lnbmF0dXJl',
        signedAt: '2026-03-02T10:05:00.000Z',
      },
    ];
    const submitted = await service.submitChangeOrder(tenantId, {
      projectId,
      title: 'Add egress window',
      description: 'Cut and frame an egress window in the basement bedroom.',
      amountCents: 485000,
      signatures,
    });

    expect(submitted.status).toBe('submitted');
    expect(submitted.signatures).toHaveLength(2);

    const missing = await rpcError(
      service.submitChangeOrder(tenantId, {
        projectId,
        title: 'Missing contractor',
        description: 'A change order without both signatures.',
        amountCents: 100,
        signatures: [signatures[0]],
      })
    );
    expect(missing.statusCode).toBe(400);
  });

  it('enforces the approval state machine', async () => {
    const submitted = await service.submitChangeOrder(tenantId, {
      projectId,
      title: 'Upgrade panel',
      description: 'Upgrade the service panel to 400 amps for the build.',
      amountCents: 620000,
      signatures: [
        {
          name: 'Olivia Owner',
          role: 'owner',
          signaturePng: 'data:image/png;base64,c2lnbmF0dXJl',
          signedAt: '2026-03-02T10:00:00.000Z',
        },
        {
          name: 'Chris Contractor',
          role: 'contractor',
          signaturePng: 'data:image/png;base64,c2lnbmF0dXJl',
          signedAt: '2026-03-02T10:05:00.000Z',
        },
      ],
    });

    const skipped = await rpcError(
      service.transitionChangeOrder(tenantId, submitted.id, 'applied')
    );
    expect(skipped.statusCode).toBe(409);

    const approved = await service.transitionChangeOrder(
      tenantId,
      submitted.id,
      'approved'
    );
    expect(approved.status).toBe('approved');

    const applied = await service.transitionChangeOrder(
      tenantId,
      submitted.id,
      'applied'
    );
    expect(applied.status).toBe('applied');

    const terminal = await rpcError(
      service.transitionChangeOrder(tenantId, submitted.id, 'rejected')
    );
    expect(terminal.statusCode).toBe(409);
  });

  it('isolates tenants and requires tenant context', async () => {
    await seedMilestone();

    expect(await service.getMilestones('other-builder', projectId)).toEqual([]);
    const missing = await rpcError(service.getMilestones('', projectId));
    expect(missing.statusCode).toBe(401);

    const notFound = await rpcError(
      service.updateMilestone(
        tenantId,
        '33333333-3333-4333-8333-333333333333',
        {
          progressPercent: 10,
        }
      )
    );
    expect(notFound.statusCode).toBe(404);
  });

  it('uploads an inspection photo with hash, GPS, scan, and sealed bytes', async () => {
    const { mkdtemp, readFile, readdir } = fsPromises;
    const { tmpdir } = os;
    const { join } = path;
    const { EnvelopeEncryptionService } = storage;
    const dir = await mkdtemp(join(tmpdir(), 'nexus-photo-'));
    const uploading = new NexusService(createDataSource(), {
      virusScanner: {
        scanFile: async () => ({
          isClean: true,
          scanDate: new Date(),
          scanner: 'test-scanner',
        }),
      },
      photoStoragePath: dir,
    });
    const bytes = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      Buffer.from('job-site concrete pour evidence photo bytes here'),
    ]);

    const photo = await uploading.uploadInspectionPhoto(tenantId, {
      projectId,
      fileName: 'pour.jpg',
      mimeType: 'image/jpeg',
      fileBase64: bytes.toString('base64'),
      capturedAt: '2026-04-01T09:00:00.000Z',
    });

    expect(photo.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(photo.antivirusStatus).toBe('clean');
    expect(photo.gps).toBeUndefined();
    const names = await readdir(join(dir, tenantId, projectId));
    expect(names).toHaveLength(1);
    const stored = await readFile(join(dir, tenantId, projectId, names[0]));
    const decrypted = new EnvelopeEncryptionService().decrypt(stored);
    expect(decrypted.equals(bytes)).toBe(true);
  });

  it('fails closed when no virus scanner is configured', async () => {
    const { mkdtemp } = fsPromises;
    const { tmpdir } = os;
    const { join } = path;
    const { VirusScanService } = storage;
    const dir = await mkdtemp(join(tmpdir(), 'nexus-photo-'));
    const uploading = new NexusService(createDataSource(), {
      virusScanner: new VirusScanService({ env: {} }),
      photoStoragePath: dir,
    });

    const result = await rpcError(
      uploading.uploadInspectionPhoto(tenantId, {
        projectId,
        fileName: 'pour.jpg',
        mimeType: 'image/jpeg',
        fileBase64: Buffer.from('bytes here').toString('base64'),
      })
    );
    expect(result.statusCode).toBe(503);
    expect(repositoryFor(NexusInspectionPhoto).records).toHaveLength(0);
  });

  it('rejects infected inspection photos without recording them', async () => {
    const { mkdtemp } = fsPromises;
    const { tmpdir } = os;
    const { join } = path;
    const dir = await mkdtemp(join(tmpdir(), 'nexus-photo-'));
    const uploading = new NexusService(createDataSource(), {
      virusScanner: {
        scanFile: async () => ({
          isClean: false,
          scanDate: new Date(),
          threats: ['Eicar-Test-Signature'],
          scanner: 'test-scanner',
        }),
      },
      photoStoragePath: dir,
    });

    const result = await rpcError(
      uploading.uploadInspectionPhoto(tenantId, {
        projectId,
        fileName: 'evil.jpg',
        mimeType: 'image/jpeg',
        fileBase64: Buffer.from('infected bytes here').toString('base64'),
      })
    );
    expect(result.statusCode).toBe(400);
    expect(repositoryFor(NexusInspectionPhoto).records).toHaveLength(0);
  });

  it('gates drawing streaming on a valid unexpired COI', async () => {
    const repository = repositoryFor(NexusDrawing);
    const valid = await repository.save({
      tenantId,
      projectId,
      title: 'Plan',
      version: 'C1',
      storageKey: 'drawings/plan.pdf',
      sha256: 'c'.repeat(64),
      coiStatus: 'valid',
      coiExpiresAt: new Date(Date.now() + 86400000),
    });
    const expired = await repository.save({
      tenantId,
      projectId,
      title: 'Old plan',
      version: 'B9',
      storageKey: 'drawings/old.pdf',
      sha256: 'd'.repeat(64),
      coiStatus: 'valid',
      coiExpiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.assertDrawingStreamable(tenantId, valid.id)
    ).resolves.toEqual(
      expect.objectContaining({ storageKey: 'drawings/plan.pdf' })
    );
    const blocked = await rpcError(
      service.assertDrawingStreamable(tenantId, expired.id)
    );
    expect(blocked.statusCode).toBe(403);
  });

  it('seals a signed PDF summary on approval and serves it back', async () => {
    const { mkdtemp } = fsPromises;
    const { tmpdir } = os;
    const { join } = path;
    const dir = await mkdtemp(join(tmpdir(), 'nexus-pdf-'));
    const pdfService = new NexusService(createDataSource(), {
      photoStoragePath: dir,
    });
    const submitted = await pdfService.submitChangeOrder(tenantId, {
      projectId,
      title: 'Add egress window',
      description: 'Cut and frame an egress window in the basement bedroom.',
      amountCents: 485000,
      signatures: [
        {
          name: 'Olivia Owner',
          role: 'owner',
          signaturePng: `data:image/png;base64,${Buffer.from(
            'fake-png-bytes-for-pdf-test'
          ).toString('base64')}`,
          signedAt: '2026-03-02T10:00:00.000Z',
        },
        {
          name: 'Chris Contractor',
          role: 'contractor',
          signaturePng: `data:image/png;base64,${Buffer.from(
            'fake-png-bytes-for-pdf-test'
          ).toString('base64')}`,
          signedAt: '2026-03-02T10:05:00.000Z',
        },
      ],
    });

    const beforeApproval = await rpcError(
      pdfService.getChangeOrderDocument(tenantId, submitted.id)
    );
    expect(beforeApproval.statusCode).toBe(409);

    const approved = await pdfService.transitionChangeOrder(
      tenantId,
      submitted.id,
      'approved'
    );
    expect(approved.status).toBe('approved');
    expect(approved.documentKey).toContain(`${submitted.id}.pdf`);

    const document = await pdfService.getChangeOrderDocument(
      tenantId,
      submitted.id
    );
    expect(document.mimeType).toBe('application/pdf');
    const pdfBytes = Buffer.from(document.fileBase64, 'base64');
    expect(pdfBytes.subarray(0, 5).toString('binary')).toBe('%PDF-');
    expect(document.sha256).toBe(storage.sha256Hex(pdfBytes));
  });
});
