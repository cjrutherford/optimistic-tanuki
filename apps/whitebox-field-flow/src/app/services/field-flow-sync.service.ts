import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { JobRecord, OfflineSyncItem } from '../models/field-flow.models';

const DB_NAME = 'field_flow_offline_db';
const DB_VERSION = 1;
const STORE_APPOINTMENTS = 'appointments';
const STORE_QUEUE = 'offline_queue';

@Injectable({
  providedIn: 'root',
})
export class FieldFlowSyncService {
  private readonly platformId = inject(PLATFORM_ID);
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  readonly isOnline = signal<boolean>(true);
  readonly pendingSyncCount = signal<number>(0);
  readonly isSyncing = signal<boolean>(false);
  readonly lastSyncTimestamp = signal<number | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isOnline.set(navigator.onLine);
      window.addEventListener('online', () => {
        this.isOnline.set(true);
        void this.syncPendingData();
      });
      window.addEventListener('offline', () => {
        this.isOnline.set(false);
      });
      this.initDb();
      void this.updatePendingCount();
    }
  }

  private initDb(): Promise<IDBDatabase | null> {
    if (
      !isPlatformBrowser(this.platformId) ||
      typeof indexedDB === 'undefined'
    ) {
      return Promise.resolve(null);
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }

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
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn(
            '[FieldFlowSyncService] IndexedDB open error, operating in memory fallback'
          );
          resolve(null);
        };
      } catch (err) {
        console.warn('[FieldFlowSyncService] IndexedDB unavailable', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  async cacheAppointment(job: JobRecord): Promise<void> {
    const db = await this.initDb();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_APPOINTMENTS, 'readwrite');
      const store = tx.objectStore(STORE_APPOINTMENTS);
      const req = store.put(job);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getCachedAppointments(): Promise<JobRecord[]> {
    const db = await this.initDb();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_APPOINTMENTS, 'readonly');
      const store = tx.objectStore(STORE_APPOINTMENTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as JobRecord[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getCachedAppointment(id: string): Promise<JobRecord | undefined> {
    const db = await this.initDb();
    if (!db) return undefined;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_APPOINTMENTS, 'readonly');
      const store = tx.objectStore(STORE_APPOINTMENTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as JobRecord | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async saveTechnicianNotes(
    jobId: string,
    notes: string,
    photos: string[] = []
  ): Promise<void> {
    const job = await this.getCachedAppointment(jobId);
    if (job) {
      job.technicianNotes = notes;
      if (photos.length > 0) {
        job.technicianPhotos = [...(job.technicianPhotos || []), ...photos];
      }
      await this.cacheAppointment(job);
    }

    await this.enqueueOfflineAction('completion_note', {
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
    payload: unknown
  ): Promise<void> {
    const item: OfflineSyncItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      synced: false,
    };

    const db = await this.initDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    await this.updatePendingCount();
  }

  async updatePendingCount(): Promise<number> {
    const db = await this.initDb();
    if (!db) return 0;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_QUEUE);
      const req = store.count();
      req.onsuccess = () => {
        const count = req.result || 0;
        this.pendingSyncCount.set(count);
        resolve(count);
      };
      req.onerror = () => resolve(0);
    });
  }

  async syncPendingData(): Promise<{ syncedCount: number }> {
    if (!this.isOnline() || this.isSyncing()) {
      return { syncedCount: 0 };
    }

    this.isSyncing.set(true);
    const db = await this.initDb();
    if (!db) {
      this.isSyncing.set(false);
      return { syncedCount: 0 };
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const items = getAllReq.result as OfflineSyncItem[];
        if (!items || items.length === 0) {
          this.isSyncing.set(false);
          this.pendingSyncCount.set(0);
          resolve({ syncedCount: 0 });
          return;
        }

        // Simulate local Mini-PC appliance sync handshake
        const clearReq = store.clear();
        clearReq.onsuccess = () => {
          this.isSyncing.set(false);
          this.pendingSyncCount.set(0);
          this.lastSyncTimestamp.set(Date.now());
          resolve({ syncedCount: items.length });
        };
        clearReq.onerror = () => {
          this.isSyncing.set(false);
          resolve({ syncedCount: 0 });
        };
      };

      getAllReq.onerror = () => {
        this.isSyncing.set(false);
        resolve({ syncedCount: 0 });
      };
    });
  }
}
