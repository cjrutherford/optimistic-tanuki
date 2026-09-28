import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ChangeOrderResponseDto,
  DrawingManifestDto,
  InspectionPhotoResponseDto,
  ProjectMilestoneDto,
} from '@optimistic-tanuki/models';

const DB_NAME = 'nexus_field_db';
const DB_VERSION = 1;
const STORE_SNAPSHOTS = 'snapshots';
const STORE_OUTBOX = 'outbox';

export type NexusSnapshotKind =
  | 'milestones'
  | 'drawings'
  | 'photos'
  | 'change-orders';

export type NexusOutboxItem = {
  id: string;
  projectId: string;
  kind: 'photo' | 'change-order';
  payload: unknown;
  idempotencyKey: string;
  attempts: number;
  lastError?: string;
};

const snapshotKey = (projectId: string, kind: NexusSnapshotKind): string =>
  `${projectId}:${kind}`;

@Injectable({
  providedIn: 'root',
})
export class NexusFieldSyncService {
  private readonly platformId = inject(PLATFORM_ID);
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private readonly memorySnapshots = new Map<string, unknown>();
  private memoryOutbox: NexusOutboxItem[] = [];

  readonly pendingUploadCount = signal<number>(0);
  readonly lastCacheTimestamp = signal<number | null>(null);

  async cacheSnapshot(
    projectId: string,
    kind: NexusSnapshotKind,
    data: unknown
  ): Promise<void> {
    const key = snapshotKey(projectId, kind);
    this.memorySnapshots.set(key, data);
    const db = await this.initDb();
    if (!db) {
      return;
    }
    try {
      await this.writeRecord(db, STORE_SNAPSHOTS, {
        key,
        data,
        cachedAt: Date.now(),
      });
      this.lastCacheTimestamp.set(Date.now());
    } catch {
      this.lastCacheTimestamp.set(Date.now());
    }
  }

  async readSnapshot<T>(
    projectId: string,
    kind: NexusSnapshotKind
  ): Promise<T | null> {
    const key = snapshotKey(projectId, kind);
    if (this.memorySnapshots.has(key)) {
      return this.memorySnapshots.get(key) as T;
    }
    const db = await this.initDb();
    if (!db) {
      return null;
    }
    try {
      const row = await this.readRecord<{ data: T }>(db, STORE_SNAPSHOTS, key);
      if (row) {
        this.memorySnapshots.set(key, row.data);
        return row.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  async enqueueOutbox(item: Omit<NexusOutboxItem, 'attempts'>): Promise<void> {
    const full: NexusOutboxItem = { ...item, attempts: 0 };
    const existing = await this.getOutboxItems();
    if (
      existing.some(
        (candidate) => candidate.idempotencyKey === full.idempotencyKey
      )
    ) {
      return;
    }
    this.memoryOutbox.push(full);
    const db = await this.initDb();
    if (db) {
      try {
        await this.writeRecord(db, STORE_OUTBOX, full);
      } catch {
        /* memory copy already holds it */
      }
    }
    await this.updatePendingCount();
  }

  async getOutboxItems(): Promise<NexusOutboxItem[]> {
    const db = await this.initDb();
    if (!db) {
      return [...this.memoryOutbox];
    }
    try {
      const rows = await this.readAll<NexusOutboxItem>(db, STORE_OUTBOX);
      for (const row of rows) {
        if (!this.memoryOutbox.some((item) => item.id === row.id)) {
          this.memoryOutbox.push(row);
        }
      }
      return [...this.memoryOutbox];
    } catch {
      return [...this.memoryOutbox];
    }
  }

  async removeOutboxItem(id: string): Promise<void> {
    this.memoryOutbox = this.memoryOutbox.filter((item) => item.id !== id);
    const db = await this.initDb();
    if (db) {
      try {
        await this.deleteRecord(db, STORE_OUTBOX, id);
      } catch {
        /* memory copy already dropped */
      }
    }
    await this.updatePendingCount();
  }

  async updatePendingCount(): Promise<number> {
    const items = await this.getOutboxItems();
    this.pendingUploadCount.set(items.length);
    return items.length;
  }

  async cachedMilestones(
    projectId: string
  ): Promise<ProjectMilestoneDto[] | null> {
    return this.readSnapshot<ProjectMilestoneDto[]>(projectId, 'milestones');
  }

  async cachedDrawings(projectId: string): Promise<DrawingManifestDto | null> {
    return this.readSnapshot<DrawingManifestDto>(projectId, 'drawings');
  }

  async cachedPhotos(
    projectId: string
  ): Promise<InspectionPhotoResponseDto[] | null> {
    return this.readSnapshot<InspectionPhotoResponseDto[]>(projectId, 'photos');
  }

  async cachedChangeOrders(
    projectId: string
  ): Promise<ChangeOrderResponseDto[] | null> {
    return this.readSnapshot<ChangeOrderResponseDto[]>(
      projectId,
      'change-orders'
    );
  }

  private initDb(): Promise<IDBDatabase | null> {
    if (
      !isPlatformBrowser(this.platformId) ||
      typeof indexedDB === 'undefined'
    ) {
      return Promise.resolve(null);
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
              db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
              db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  }

  private writeRecord(
    db: IDBDatabase,
    store: string,
    value: Record<string, unknown>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(store, 'readwrite');
        transaction.objectStore(store).put(value);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  private readRecord<T>(
    db: IDBDatabase,
    store: string,
    key: string
  ): Promise<T | null> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(store, 'readonly');
        const request = transaction.objectStore(store).get(key);
        request.onsuccess = () => resolve((request.result as T) ?? null);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  private readAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(store, 'readonly');
        const request = transaction.objectStore(store).getAll();
        request.onsuccess = () => resolve((request.result as T[]) ?? []);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  private deleteRecord(
    db: IDBDatabase,
    store: string,
    key: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(store, 'readwrite');
        transaction.objectStore(store).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      }
    });
  }
}
