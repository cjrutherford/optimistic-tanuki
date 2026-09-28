import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JobRecord, OfflineSyncItem } from '../models/field-flow.models';

const DB_NAME = 'field_flow_offline_db';
const DB_VERSION = 2;
const STORE_APPOINTMENTS = 'appointments';
const STORE_QUEUE = 'offline_queue';
const SYNC_PATH = '/api/v1/flow/sync';

export const FIELD_FLOW_MEMORY_QUEUE_LIMIT = 100;

export const FIELD_FLOW_MAX_SYNC_ATTEMPTS = 10;

export type FieldFlowStorageMode = 'indexeddb' | 'memory';

type FlowSyncWireResponse = {
  results?: Array<{
    id?: string;
    acknowledged?: boolean;
  }>;
} | null;

export type LegacyQueueRow = {
  id: string;
  type: OfflineSyncItem['type'] | string;
  payload: unknown;
  timestamp: number;
  synced?: boolean;
  idempotencyKey?: string;
  attempts?: number;
  lastError?: string;
};

export function migrateLegacyQueueRows(rows: LegacyQueueRow[]): Array<
  LegacyQueueRow & {
    idempotencyKey: string;
    attempts: number;
    synced: boolean;
  }
> {
  const usedKeys = new Set<string>();
  return rows.map((row, index) => {
    const providedKey = row.idempotencyKey?.trim();
    const baseKey = providedKey || `legacy:${row.id}:${row.timestamp}`;
    let idempotencyKey = baseKey;
    let suffix = index;
    while (usedKeys.has(idempotencyKey)) {
      suffix += 1;
      idempotencyKey = `${baseKey}:${suffix}`;
    }
    usedKeys.add(idempotencyKey);
    const attempts =
      typeof row.attempts === 'number' &&
      Number.isInteger(row.attempts) &&
      row.attempts >= 0
        ? row.attempts
        : 0;
    const synced = typeof row.synced === 'boolean' ? row.synced : false;
    return { ...row, idempotencyKey, attempts, synced };
  });
}

@Injectable({
  providedIn: 'root',
})
export class FieldFlowSyncService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly memoryQueue: OfflineSyncItem[] = [];
  private readonly memoryAppointments = new Map<string, JobRecord>();
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryIdSequence = 0;

  readonly isOnline = signal<boolean>(true);
  readonly pendingSyncCount = signal<number>(0);
  readonly failedSyncCount = signal<number>(0);
  readonly isSyncing = signal<boolean>(false);
  readonly lastSyncTimestamp = signal<number | null>(null);
  readonly storageMode = signal<FieldFlowStorageMode>('memory');
  readonly storageWarning = signal<string | null>(null);
  readonly isMemoryFallback = signal<boolean>(true);
  readonly isUsingMemoryFallback = computed(
    () => this.storageMode() === 'memory'
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isOnline.set(
        typeof navigator === 'undefined' ? true : navigator.onLine
      );
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          this.isOnline.set(true);
          void this.syncPendingData();
        });
        window.addEventListener('offline', () => {
          this.isOnline.set(false);
        });
      }
      void this.initializeStorage();
    } else {
      this.useMemoryStorage('IndexedDB is unavailable during server rendering');
    }
  }

  async cacheAppointment(job: JobRecord): Promise<void> {
    this.memoryAppointments.set(job.id, job);
    const db = await this.initDb();
    if (!db) return;

    try {
      await this.writeRecord(db, STORE_APPOINTMENTS, job);
    } catch {
      this.useMemoryStorage('IndexedDB appointment writes are unavailable');
    }
  }

  async getCachedAppointments(): Promise<JobRecord[]> {
    const db = await this.initDb();
    const appointments = new Map(this.memoryAppointments);
    if (!db) return Array.from(appointments.values());

    try {
      const stored = await this.readAll<JobRecord>(db, STORE_APPOINTMENTS);
      for (const appointment of stored) {
        appointments.set(appointment.id, appointment);
      }
    } catch {
      this.useMemoryStorage('IndexedDB appointment reads are unavailable');
    }
    return Array.from(appointments.values());
  }

  async getCachedAppointment(id: string): Promise<JobRecord | undefined> {
    const memoryAppointment = this.memoryAppointments.get(id);
    if (memoryAppointment) return memoryAppointment;

    const db = await this.initDb();
    if (!db) return undefined;

    try {
      return await this.readRecord<JobRecord>(db, STORE_APPOINTMENTS, id);
    } catch {
      this.useMemoryStorage('IndexedDB appointment reads are unavailable');
      return undefined;
    }
  }

  async saveTechnicianNotes(
    jobId: string,
    notes: string,
    photos: string[] = []
  ): Promise<void> {
    const job = await this.getCachedAppointment(jobId);
    if (job) {
      const updated: JobRecord = {
        ...job,
        technicianNotes: notes,
        technicianPhotos: [...(job.technicianPhotos || []), ...photos],
      };
      await this.cacheAppointment(updated);
    }

    await this.enqueueOfflineAction('completion_note', {
      idempotencyKey: this.createId('note'),
      jobId,
      notes,
      photos,
      updatedAt: new Date().toISOString(),
    });

    if (this.isOnline()) {
      await this.syncPendingData();
    }
  }

  async enqueueOfflineAction(
    type: OfflineSyncItem['type'],
    payload: unknown,
    idempotencyKey?: string
  ): Promise<void> {
    const key = this.resolveIdempotencyKey(type, payload, idempotencyKey);
    const item: OfflineSyncItem = {
      id: this.createId('sync'),
      type,
      payload,
      timestamp: Date.now(),
      synced: false,
      idempotencyKey: key,
      attempts: 0,
    };

    const db = await this.initDb();
    if (
      this.memoryQueue.some((candidate) => candidate.idempotencyKey === key)
    ) {
      await this.updatePendingCount();
      return;
    }
    if (db) {
      try {
        const existing = await this.readAll<OfflineSyncItem>(db, STORE_QUEUE);
        if (existing.some((candidate) => candidate.idempotencyKey === key)) {
          await this.updatePendingCount();
          return;
        }
        await this.writeRecord(db, STORE_QUEUE, item);
        await this.updatePendingCount();
        return;
      } catch {
        this.useMemoryStorage('IndexedDB queue writes are unavailable');
      }
    }

    if (!this.addToMemoryQueue(item)) {
      throw new Error(
        `Memory sync queue is full at ${FIELD_FLOW_MEMORY_QUEUE_LIMIT} items`
      );
    }
    await this.updatePendingCount();
  }

  async updatePendingCount(): Promise<number> {
    const items = await this.getQueueItems();
    const pending = items.filter(
      (item) => !item.synced && !item.failedPermanently
    );
    const failed = items.filter(
      (item) => !item.synced && item.failedPermanently
    );
    this.pendingSyncCount.set(pending.length);
    this.failedSyncCount.set(failed.length);
    return pending.length;
  }

  async syncPendingData(): Promise<{ syncedCount: number }> {
    if (!this.isOnline() || this.isSyncing()) {
      return { syncedCount: 0 };
    }

    this.isSyncing.set(true);
    try {
      const items = (await this.getQueueItems()).filter(
        (item) => !item.synced && !item.failedPermanently
      );
      if (items.length === 0) {
        await this.updatePendingCount();
        return { syncedCount: 0 };
      }
      if (!this.http) {
        await this.markItemsFailed(items, 'Sync HTTP client is unavailable');
        await this.updatePendingCount();
        return { syncedCount: 0 };
      }

      let response: FlowSyncWireResponse;
      try {
        response = await firstValueFrom(
          this.http.post<FlowSyncWireResponse>(SYNC_PATH, {
            items: items.map((item) => this.toWireItem(item)),
          })
        );
      } catch (error) {
        await this.markItemsFailed(
          items,
          this.errorMessage(error),
          this.isPermanentSyncError(error)
        );
        await this.updatePendingCount();
        return { syncedCount: 0 };
      }

      const acknowledgedIds = this.getAcknowledgedIds(response, items);
      for (const item of items) {
        if (acknowledgedIds.has(item.id)) {
          await this.removeQueueItem(item.id);
        } else {
          await this.markItemFailed(
            item,
            'Gateway did not acknowledge the item'
          );
        }
      }

      const syncedCount = acknowledgedIds.size;
      if (syncedCount > 0) {
        this.lastSyncTimestamp.set(Date.now());
      }
      await this.updatePendingCount();
      return { syncedCount };
    } finally {
      this.isSyncing.set(false);
    }
  }

  private async initializeStorage(): Promise<void> {
    await this.initDb();
    await this.updatePendingCount();
  }

  private initDb(): Promise<IDBDatabase | null> {
    if (
      !isPlatformBrowser(this.platformId) ||
      typeof indexedDB === 'undefined'
    ) {
      this.useMemoryStorage('IndexedDB is unavailable');
      return Promise.resolve(null);
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_APPOINTMENTS)) {
            db.createObjectStore(STORE_APPOINTMENTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_QUEUE)) {
            db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
          }
          const transaction = request.transaction;
          if (transaction && db.objectStoreNames.contains(STORE_QUEUE)) {
            const queueStore = transaction.objectStore(STORE_QUEUE);
            const readRequest = queueStore.getAll();
            readRequest.onsuccess = () => {
              const rows = migrateLegacyQueueRows(
                readRequest.result as LegacyQueueRow[]
              );
              for (const row of rows) {
                queueStore.put(row);
              }
            };
          }
        };
        request.onsuccess = () => {
          this.storageMode.set('indexeddb');
          this.isMemoryFallback.set(false);
          resolve(request.result);
        };
        request.onerror = () => {
          this.useMemoryStorage('IndexedDB could not be opened');
          resolve(null);
        };
        request.onblocked = () => {
          this.useMemoryStorage('IndexedDB is blocked by another connection');
          resolve(null);
        };
      } catch {
        this.useMemoryStorage('IndexedDB is unavailable');
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private async readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async readRecord<T>(
    db: IDBDatabase,
    storeName: string,
    id: string
  ): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(id);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async writeRecord(
    db: IDBDatabase,
    storeName: string,
    value: unknown
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private async deleteRecord(
    db: IDBDatabase,
    storeName: string,
    id: string
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private async getQueueItems(): Promise<OfflineSyncItem[]> {
    const items = new Map<string, OfflineSyncItem>();
    const idempotencyKeys = new Set<string>();
    for (const item of this.memoryQueue) {
      items.set(item.id, item);
      idempotencyKeys.add(item.idempotencyKey);
    }

    const db = await this.initDb();
    if (db) {
      try {
        const stored = await this.readAll<OfflineSyncItem>(db, STORE_QUEUE);
        for (const item of stored) {
          if (
            !items.has(item.id) &&
            !idempotencyKeys.has(item.idempotencyKey)
          ) {
            items.set(item.id, item);
            idempotencyKeys.add(item.idempotencyKey);
          }
        }
      } catch {
        this.useMemoryStorage('IndexedDB queue reads are unavailable');
      }
    }
    return Array.from(items.values());
  }

  private addToMemoryQueue(item: OfflineSyncItem): boolean {
    if (
      this.memoryQueue.some(
        (candidate) => candidate.idempotencyKey === item.idempotencyKey
      )
    ) {
      return true;
    }
    if (this.memoryQueue.length >= FIELD_FLOW_MEMORY_QUEUE_LIMIT) {
      this.storageWarning.set(
        `Memory sync queue is full at ${FIELD_FLOW_MEMORY_QUEUE_LIMIT} items`
      );
      return false;
    }
    this.memoryQueue.push(item);
    return true;
  }

  private async removeQueueItem(id: string): Promise<void> {
    const memoryIndex = this.memoryQueue.findIndex((item) => item.id === id);
    const db = await this.initDb();

    if (db) {
      try {
        await this.deleteRecord(db, STORE_QUEUE, id);
      } catch {
        this.useMemoryStorage('IndexedDB queue deletes are unavailable');
        return;
      }
    }
    if (memoryIndex >= 0) {
      this.memoryQueue.splice(memoryIndex, 1);
    }
  }

  private async markItemFailed(
    item: OfflineSyncItem,
    message: string,
    permanent = false
  ): Promise<void> {
    const attempts = item.attempts + 1;
    const updated: OfflineSyncItem = {
      ...item,
      attempts,
      lastError: message,
      synced: false,
    };
    if (permanent || attempts >= FIELD_FLOW_MAX_SYNC_ATTEMPTS) {
      updated.failedPermanently = true;
    }
    const memoryIndex = this.memoryQueue.findIndex(
      (candidate) => candidate.id === item.id
    );
    if (memoryIndex >= 0) {
      this.memoryQueue[memoryIndex] = updated;
    }
    const db = await this.initDb();
    if (db) {
      try {
        await this.writeRecord(db, STORE_QUEUE, updated);
      } catch {
        this.useMemoryStorage('IndexedDB queue updates are unavailable');
        this.addToMemoryQueue(updated);
      }
    } else {
      this.addToMemoryQueue(updated);
    }
  }

  private async markItemsFailed(
    items: OfflineSyncItem[],
    message: string,
    permanent = false
  ): Promise<void> {
    for (const item of items) {
      await this.markItemFailed(item, message, permanent);
    }
  }

  private isPermanentSyncError(error: unknown): boolean {
    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : undefined;
    if (status === undefined) {
      return false;
    }
    if (status === 408 || status === 425 || status === 429) {
      return false;
    }
    return status >= 400 && status < 500;
  }

  private toWireItem(item: OfflineSyncItem): Record<string, unknown> {
    return {
      id: item.id,
      type: item.type,
      payload: item.payload,
      timestamp: item.timestamp,
      synced: false,
      attempts: item.attempts,
      idempotencyKey: item.idempotencyKey,
    };
  }

  private getAcknowledgedIds(
    response: FlowSyncWireResponse,
    items: OfflineSyncItem[]
  ): Set<string> {
    const acknowledged = new Set<string>();
    if (!response) return acknowledged;

    const addAcknowledged = (value: unknown): void => {
      if (typeof value !== 'string' || !value.trim()) return;
      const item = items.find(
        (candidate) =>
          candidate.id === value || candidate.idempotencyKey === value
      );
      if (item) acknowledged.add(item.id);
    };

    if (Array.isArray(response.results)) {
      for (const result of response.results) {
        if (result?.acknowledged === true) {
          addAcknowledged(result.id);
        }
      }
    }
    return acknowledged;
  }

  private resolveIdempotencyKey(
    type: OfflineSyncItem['type'],
    payload: unknown,
    provided?: string
  ): string {
    if (provided?.trim()) return provided.trim();
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (
        typeof record['idempotencyKey'] === 'string' &&
        record['idempotencyKey'].trim()
      ) {
        return record['idempotencyKey'].trim();
      }
    }
    return this.createId(type);
  }

  private createId(prefix: string): string {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID) {
      return `${prefix}_${cryptoApi.randomUUID()}`;
    }
    if (cryptoApi?.getRandomValues) {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      return `${prefix}_${Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('')}`;
    }
    this.memoryIdSequence += 1;
    return `${prefix}_${Date.now().toString(
      36
    )}_${this.memoryIdSequence.toString(36)}`;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private useMemoryStorage(message: string): void {
    this.storageMode.set('memory');
    this.isMemoryFallback.set(true);
    this.storageWarning.set(message);
  }
}
