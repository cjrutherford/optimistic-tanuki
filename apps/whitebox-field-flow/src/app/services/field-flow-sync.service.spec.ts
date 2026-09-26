import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  FIELD_FLOW_MEMORY_QUEUE_LIMIT,
  FieldFlowSyncService,
} from './field-flow-sync.service';
import * as fieldFlowSyncModule from './field-flow-sync.service';
import { JobRecord } from '../models/field-flow.models';

const cachedJob: JobRecord = {
  id: 'cached-job-1',
  trackingNumber: 'TRACK-CACHED-1',
  customerName: 'Cached Customer',
  customerPhone: '+1 912 555 0100',
  streetAddress: '1 Cached Way',
  servicePackageName: 'Standard Care',
  scheduledDate: '2026-10-02',
  arrivalWindow: '10:00 AM - 12:00 PM',
  totalPrice: 101,
  depositPaid: 0,
  balanceRemaining: 101,
  status: 'scheduled',
};

type LegacyQueueRow = {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  synced?: boolean;
  idempotencyKey?: string;
  attempts?: number;
};

type MemoryQueueRow = {
  id: string;
  attempts: number;
  idempotencyKey: string;
};

const memoryQueue = (service: FieldFlowSyncService): MemoryQueueRow[] =>
  (
    service as unknown as {
      memoryQueue: MemoryQueueRow[];
    }
  ).memoryQueue;

describe('FieldFlowSyncService', () => {
  let service: FieldFlowSyncService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FieldFlowSyncService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(FieldFlowSyncService);
    service.isOnline.set(true);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reports browser and memory queue state without crashing on SSR-safe paths', () => {
    expect(typeof service.isOnline()).toBe('boolean');
    expect(service.pendingSyncCount()).toBe(0);
    expect(['indexeddb', 'memory']).toContain(service.storageMode());
  });

  it('deduplicates queue items with the same idempotency key', async () => {
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'booking-key-1',
      bookingId: 'booking-1',
    });
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'booking-key-1',
      bookingId: 'booking-1',
    });

    expect(await service.updatePendingCount()).toBe(1);
  });

  it('migrates every legacy queue row to a distinct stable key', () => {
    const migrate = (
      fieldFlowSyncModule as unknown as {
        migrateLegacyQueueRows: (
          rows: LegacyQueueRow[]
        ) => Array<LegacyQueueRow & { idempotencyKey: string }>;
      }
    ).migrateLegacyQueueRows;
    const rows: LegacyQueueRow[] = [
      {
        id: 'legacy-1',
        type: 'booking',
        payload: { bookingId: 'booking-1' },
        timestamp: 100,
        synced: false,
      },
      {
        id: 'legacy-2',
        type: 'booking',
        payload: { bookingId: 'booking-2' },
        timestamp: 100,
        synced: false,
      },
    ];

    const migrated = migrate(rows);

    expect(migrated).toHaveLength(2);
    expect(new Set(migrated.map((row) => row.idempotencyKey)).size).toBe(2);
    expect(migrated[0].idempotencyKey).toContain('legacy-1');
    expect(migrate(rows)).toEqual(migrated);
  });

  it('defaults legacy retry metadata while preserving valid values', () => {
    const migrate = (
      fieldFlowSyncModule as unknown as {
        migrateLegacyQueueRows: (
          rows: LegacyQueueRow[]
        ) => Array<LegacyQueueRow & { idempotencyKey: string }>;
      }
    ).migrateLegacyQueueRows;
    const rows: LegacyQueueRow[] = [
      {
        id: 'legacy-defaults',
        type: 'booking',
        payload: { bookingId: 'booking-1' },
        timestamp: 200,
      },
      {
        id: 'legacy-existing',
        type: 'payment',
        payload: { trackingCode: 'TRACK-1' },
        timestamp: 201,
        attempts: 3,
        synced: true,
      },
    ];

    const migrated = migrate(rows);

    expect(migrated[0]).toEqual(
      expect.objectContaining({ attempts: 0, synced: false })
    );
    expect(migrated[1]).toEqual(
      expect.objectContaining({ attempts: 3, synced: true })
    );
  });

  it('keeps failed and non-2xx items and reports zero acknowledged items', async () => {
    await service.enqueueOfflineAction('payment', {
      idempotencyKey: 'payment-key-1',
      trackingCode: 'TRACK-1',
    });

    const firstSync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const firstRequest = httpMock.expectOne('/api/v1/flow/sync');
    expect(firstRequest.request.method).toBe('POST');
    expect(firstRequest.request.body.items).toHaveLength(1);
    expect(firstRequest.request.body.items[0]).toEqual(
      expect.objectContaining({
        type: 'payment',
        idempotencyKey: 'payment-key-1',
        synced: false,
        attempts: 0,
      })
    );
    firstRequest.flush('gateway unavailable', {
      status: 503,
      statusText: 'Unavailable',
    });

    await expect(firstSync).resolves.toEqual({ syncedCount: 0 });
    expect(await service.updatePendingCount()).toBe(1);

    const secondSync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const secondRequest = httpMock.expectOne('/api/v1/flow/sync');
    secondRequest.flush({ acknowledged: false });
    await expect(secondSync).resolves.toEqual({ syncedCount: 0 });
    expect(await service.updatePendingCount()).toBe(1);
  });

  it('does not count a successful response without an acknowledgement', async () => {
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'unacknowledged-key-1',
      bookingId: 'booking-1',
    });

    const sync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/api/v1/flow/sync');
    request.flush(null);

    await expect(sync).resolves.toEqual({ syncedCount: 0 });
    expect(await service.updatePendingCount()).toBe(1);
  });

  it('does not treat generic success booleans as acknowledgement', async () => {
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'ambiguous-key-1',
      bookingId: 'booking-1',
    });

    const sync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/api/v1/flow/sync');
    request.flush({ success: true, accepted: true, acknowledged: true });

    await expect(sync).resolves.toEqual({ syncedCount: 0 });
    expect(memoryQueue(service)[0].attempts).toBe(1);
  });

  it('keeps unacknowledged items while removing an explicitly acknowledged item', async () => {
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'partial-key-1',
      bookingId: 'booking-1',
    });
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'partial-key-2',
      bookingId: 'booking-2',
    });

    const sync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/api/v1/flow/sync');
    const firstId = request.request.body.items[0].id as string;
    request.flush({ results: [{ id: firstId, acknowledged: true }] });

    await expect(sync).resolves.toEqual({ syncedCount: 1 });
    expect(memoryQueue(service)).toHaveLength(1);
    expect(memoryQueue(service)[0].attempts).toBe(1);
  });

  it('does not acknowledge an item marked false', async () => {
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'false-key-1',
      bookingId: 'booking-1',
    });

    const sync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/api/v1/flow/sync');
    const itemId = request.request.body.items[0].id as string;
    request.flush({ results: [{ id: itemId, acknowledged: false }] });

    await expect(sync).resolves.toEqual({ syncedCount: 0 });
    expect(memoryQueue(service)[0].attempts).toBe(1);
  });

  it('ignores a bare acknowledgedIds list without explicit results', async () => {
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'explicit-key-1',
      bookingId: 'booking-1',
    });

    const sync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/api/v1/flow/sync');
    request.flush({ acknowledgedIds: ['explicit-key-1'] });

    await expect(sync).resolves.toEqual({ syncedCount: 0 });
    expect(await service.updatePendingCount()).toBe(1);
  });

  it('requires results entries even when an id matches', async () => {
    await service.enqueueOfflineAction('completion_note', {
      idempotencyKey: 'note-key-1',
      jobId: 'job-1',
      notes: 'Surface sealed',
    });

    const sync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/api/v1/flow/sync');
    const itemId = request.request.body.items[0].id as string;
    request.flush({ acknowledgedIds: [itemId] });

    await expect(sync).resolves.toEqual({ syncedCount: 0 });
    expect(await service.updatePendingCount()).toBe(1);
  });

  it('marks items permanently failed on a 4xx rejection and stops retrying them', async () => {
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'rejected-key-1',
      bookingId: 'booking-1',
    });

    const sync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/api/v1/flow/sync');
    request.flush(
      { message: 'Invalid payload' },
      { status: 422, statusText: 'Unprocessable Entity' }
    );

    await expect(sync).resolves.toEqual({ syncedCount: 0 });
    expect(memoryQueue(service)[0].failedPermanently).toBe(true);
    expect(await service.updatePendingCount()).toBe(0);
    expect(service.failedSyncCount()).toBe(1);

    const retry = service.syncPendingData();
    await expect(retry).resolves.toEqual({ syncedCount: 0 });
    httpMock.expectNone('/api/v1/flow/sync');
  });

  it('retries items after a 5xx failure without marking them permanent', async () => {
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'retry-key-1',
      bookingId: 'booking-1',
    });

    const sync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/api/v1/flow/sync');
    request.flush(
      { message: 'Upstream unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    await expect(sync).resolves.toEqual({ syncedCount: 0 });
    expect(memoryQueue(service)[0].failedPermanently).toBeFalsy();
    expect(await service.updatePendingCount()).toBe(1);
    expect(service.failedSyncCount()).toBe(0);
  });

  it('treats 429 as retryable rather than permanent', async () => {
    await service.enqueueOfflineAction('booking', {
      idempotencyKey: 'throttle-key-1',
      bookingId: 'booking-1',
    });

    const sync = service.syncPendingData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/api/v1/flow/sync');
    request.flush(
      { message: 'Too many requests' },
      { status: 429, statusText: 'Too Many Requests' }
    );

    await expect(sync).resolves.toEqual({ syncedCount: 0 });
    expect(memoryQueue(service)[0].failedPermanently).toBeFalsy();
    expect(await service.updatePendingCount()).toBe(1);
  });

  it('rejects a memory queue overflow without dropping the enqueue silently', async () => {
    for (let index = 0; index < FIELD_FLOW_MEMORY_QUEUE_LIMIT; index += 1) {
      await service.enqueueOfflineAction('photo', {
        idempotencyKey: `photo-key-${index}`,
        jobId: 'job-1',
        photoId: String(index),
      });
    }

    await expect(
      service.enqueueOfflineAction('photo', {
        idempotencyKey: 'photo-overflow',
        jobId: 'job-1',
      })
    ).rejects.toThrow(/memory sync queue is full/i);

    expect(service.storageWarning()).not.toBeNull();
    expect(await service.updatePendingCount()).toBe(
      FIELD_FLOW_MEMORY_QUEUE_LIMIT
    );
  });

  it('caches appointments in memory for explicit offline reads', async () => {
    await service.cacheAppointment(cachedJob);
    service.isOnline.set(false);

    await expect(service.getCachedAppointment('cached-job-1')).resolves.toEqual(
      cachedJob
    );
    await expect(
      service.getCachedAppointment('missing-job')
    ).resolves.toBeUndefined();
  });
});
