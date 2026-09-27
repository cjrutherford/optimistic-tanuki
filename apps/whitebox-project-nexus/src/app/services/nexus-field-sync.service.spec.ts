import { TestBed } from '@angular/core/testing';
import { NexusFieldSyncService } from './nexus-field-sync.service';

describe('NexusFieldSyncService', () => {
  let service: NexusFieldSyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NexusFieldSyncService);
  });

  it('caches and reads snapshots without a backend', async () => {
    await service.cacheSnapshot('project-1', 'milestones', [{ id: 'm-1' }]);

    await expect(service.cachedMilestones('project-1')).resolves.toEqual([
      { id: 'm-1' },
    ]);
    await expect(service.cachedMilestones('project-2')).resolves.toBeNull();
  });

  it('deduplicates outbox items by idempotency key', async () => {
    await service.enqueueOutbox({
      id: 'item-1',
      projectId: 'project-1',
      kind: 'photo',
      payload: {},
      idempotencyKey: 'key-1',
    });
    await service.enqueueOutbox({
      id: 'item-2',
      projectId: 'project-1',
      kind: 'photo',
      payload: {},
      idempotencyKey: 'key-1',
    });

    expect(await service.updatePendingCount()).toBe(1);
    await service.removeOutboxItem('item-1');
    expect(await service.updatePendingCount()).toBe(0);
  });
});
