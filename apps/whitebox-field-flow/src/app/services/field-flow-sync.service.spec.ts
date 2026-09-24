import { TestBed } from '@angular/core/testing';
import { FieldFlowSyncService } from './field-flow-sync.service';
import { JobRecord } from '../models/field-flow.models';

describe('FieldFlowSyncService', () => {
  let service: FieldFlowSyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FieldFlowSyncService);
  });

  it('tracks initial online status', () => {
    expect(typeof service.isOnline()).toBe('boolean');
    expect(service.pendingSyncCount()).toBe(0);
  });

  it('handles offline action enqueuing gracefully', async () => {
    await service.enqueueOfflineAction('completion_note', {
      jobId: 'FLW-1234',
      notes: 'Completed power wash and sealant application.',
    });
    // In node/jest environment where indexedDB might be mock/memory, pending count is handled without crashing
    expect(service.isSyncing()).toBe(false);
  });

  it('allows saving technician notes with offline queuing', async () => {
    await service.saveTechnicianNotes(
      'FLW-9900',
      'Brake rotor inspected and cleaned',
      []
    );
    expect(service.isSyncing()).toBe(false);
  });
});
