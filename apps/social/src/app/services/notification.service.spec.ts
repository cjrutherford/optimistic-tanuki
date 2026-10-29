jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import { NotificationService } from './notification.service';
import {
  Notification,
  NotificationType,
} from '../../entities/notification.entity';

const recipientId = '123e4567-e89b-42d3-a456-426614174001';
const notificationId = '123e4567-e89b-42d3-a456-426614174000';
const stored = (overrides: Record<string, unknown> = {}) =>
  ({
    id: notificationId,
    recipientId,
    type: NotificationType.MENTION,
    title: 'forged text',
    body: 'https://attacker.example',
    isRead: false,
    createdAt: new Date('2025-01-02T03:04:05.000Z'),
    actionUrl: 'https://attacker.example',
    ...overrides,
  } as Notification);

describe('NotificationService safe persistence and projection', () => {
  const repo = () => ({
    manager: {
      transaction: jest.fn(async (run) =>
        run({ query: jest.fn(async () => []) })
      ),
    },
    create: jest.fn((data) => ({
      id: notificationId,
      isRead: false,
      createdAt: new Date('2025-01-02T03:04:05.000Z'),
      ...data,
    })),
    save: jest.fn(async (row) => row),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  });

  it('persists only canonical recipient, allowlisted type and server template', async () => {
    const repository = repo();
    const service = new NotificationService(repository as any);
    const result = await service.create({
      recipientId: recipientId.toUpperCase(),
      type: 'mention',
      title: 'forged',
      body: 'https://evil.example',
      senderId: 'private',
      resourceType: 'post',
      resourceId: 'private',
      actionUrl: 'https://evil.example',
      id: 'attacker-id',
      isRead: true,
      createdAt: '2000-01-01',
    } as any);

    expect(repository.create).toHaveBeenCalledWith({
      recipientId,
      type: 'mention',
      title: 'You were mentioned',
      body: 'Someone mentioned you in a post',
    });
    expect(result).toEqual({
      id: notificationId,
      recipientId,
      type: 'mention',
      title: 'You were mentioned',
      body: 'Someone mentioned you in a post',
      isRead: false,
      createdAt: '2025-01-02T03:04:05.000Z',
    });
  });

  it('rejects malformed recipient and unknown create type before database access', async () => {
    const repository = repo();
    const service = new NotificationService(repository as any);
    await expect(
      service.create({ recipientId: 'bad', type: 'like', title: '', body: '' })
    ).rejects.toBeDefined();
    await expect(
      service.create({ recipientId, type: 'custom', title: '', body: '' })
    ).rejects.toBeDefined();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('keeps debounce grouping while flushing only the safe notification template', async () => {
    jest.useFakeTimers();
    const repository = repo();
    const service = new NotificationService(repository as any);
    const queued = {
      recipientId,
      type: 'like',
      title: 'private title',
      body: 'https://attacker.example/private',
      resourceType: 'post',
      resourceId: 'post-id',
    };

    await service.queueNotification(queued);
    await jest.advanceTimersByTimeAsync(4 * 60 * 1000);
    await service.queueNotification(queued);
    await jest.advanceTimersByTimeAsync(4 * 60 * 1000);
    expect(repository.save).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(60 * 1000);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith({
      recipientId,
      type: 'like',
      title: 'New like',
      body: 'Someone liked your post',
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('projects reads and drops malformed or legacy rows with untrusted text', async () => {
    const repository = repo();
    repository.find.mockResolvedValue([
      stored(),
      stored({
        type: 'old_type',
        title: 'old secret',
        body: 'javascript:alert(1)',
      }),
      stored({ id: 'malformed' }),
    ] as any);
    const service = new NotificationService(repository as any);
    await expect(service.findByRecipient(recipientId)).resolves.toEqual([
      {
        id: notificationId,
        recipientId,
        type: 'mention',
        title: 'You were mentioned',
        body: 'Someone mentioned you in a post',
        isRead: false,
        createdAt: '2025-01-02T03:04:05.000Z',
      },
      {
        id: notificationId,
        recipientId,
        type: 'system',
        title: 'Notification',
        body: 'You have a new notification',
        isRead: false,
        createdAt: '2025-01-02T03:04:05.000Z',
      },
    ]);
    repository.findOne.mockResolvedValue(stored() as any);
    await expect(service.findOne(notificationId)).resolves.toMatchObject({
      body: 'Someone mentioned you in a post',
    });
  });

  it('rejects malformed query identities before repository access', async () => {
    const repository = repo();
    const service = new NotificationService(repository as any);
    await expect(service.findByRecipient('bad')).rejects.toBeDefined();
    await expect(service.findOne('bad')).rejects.toBeDefined();
    await expect(service.markAllAsRead('bad')).rejects.toBeDefined();
    await expect(service.getUnreadCount('bad')).rejects.toBeDefined();
    expect(repository.find).not.toHaveBeenCalled();
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.count).not.toHaveBeenCalled();
  });

  it('scopes mutations to canonical UUID identities and checks affected counts', async () => {
    const repository = repo();
    repository.update.mockResolvedValue({ affected: 0 } as any);
    repository.delete.mockResolvedValue({ affected: 0 } as any);
    const service = new NotificationService(repository as any);
    await expect(
      service.markAsRead(
        notificationId.toUpperCase(),
        recipientId.toUpperCase()
      )
    ).rejects.toMatchObject({ error: { statusCode: 404 } });
    expect(repository.update).toHaveBeenCalledWith(
      { id: notificationId, recipientId },
      { isRead: true }
    );
    await expect(
      service.delete(notificationId, recipientId)
    ).rejects.toMatchObject({ error: { statusCode: 404 } });
    expect(repository.delete).toHaveBeenCalledWith({
      id: notificationId,
      recipientId,
    });
  });
});

describe('N01 volatile notification work', () => {
  const event = {
    recipientId,
    type: 'mention',
    title: 'PRIVATE_TITLE',
    body: 'PRIVATE_BODY',
    senderId: 'PRIVATE_SENDER',
    actionUrl: 'https://PRIVATE.example',
  };
  const repository = () => ({
    manager: {
      transaction: jest.fn(async (run) =>
        run({ query: jest.fn(async () => []) })
      ),
    },
    create: jest.fn((value) => ({
      ...value,
      id: notificationId,
      isRead: false,
      createdAt: new Date(),
    })),
    save: jest.fn(async (value) => value),
  });
  afterEach(() => jest.useRealTimers());

  it('stores only canonical typed work and cancellation clears a queued timer', async () => {
    jest.useFakeTimers();
    const repo = repository();
    const service = new NotificationService(repo as any);
    await service.queueNotification({
      ...event,
      recipientId: recipientId.toUpperCase(),
    });
    expect(
      JSON.stringify(
        [...(service as any).pendingNotifications.values()].map(
          (row: any) => row.data
        )
      )
    ).not.toContain('PRIVATE');
    await expect(
      service.cancelPendingForRecipient(recipientId)
    ).resolves.toEqual({ cancelledPending: 1, drainedWrites: 0 });
    await jest.advanceTimersByTimeAsync(300001);
    expect(repo.save).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it('waits for an in-flight write and rejects new work during cancellation', async () => {
    const repo = repository();
    let release!: () => void;
    const barrier = new Promise<void>((done) => {
      release = done;
    });
    repo.save.mockImplementationOnce(async (value) => {
      await barrier;
      return value;
    });
    const service = new NotificationService(repo as any);
    const write = service.create(event);
    let acknowledged = false;
    const cancel = service
      .cancelPendingForRecipient(recipientId)
      .then((value) => {
        acknowledged = true;
        return value;
      });
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    await expect(service.create(event)).rejects.toBeDefined();
    await expect(service.queueNotification(event)).rejects.toBeDefined();
    release();
    await write;
    await expect(cancel).resolves.toEqual({
      cancelledPending: 0,
      drainedWrites: 1,
    });
    expect(repo.save).toHaveBeenCalledTimes(1);
    // This cancels an existing batch; D00 supplies the permanent account fence.
    await service.create(event);
    expect(repo.save).toHaveBeenCalledTimes(2);
    await service.onModuleDestroy();
  });

  it('shutdown discards volatile work and prevents a later timer or producer write', async () => {
    jest.useFakeTimers();
    const repo = repository();
    const service = new NotificationService(repo as any);
    await service.queueNotification(event);
    await service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(300001);
    expect(repo.save).not.toHaveBeenCalled();
    await expect(service.create(event)).rejects.toBeDefined();
  });

  it('does not cancel another recipient and rejects malformed work before queueing', async () => {
    jest.useFakeTimers();
    const repo = repository();
    const service = new NotificationService(repo as any);
    await service.queueNotification(event);
    await service.cancelPendingForRecipient(notificationId);
    await jest.advanceTimersByTimeAsync(300001);
    expect(repo.save).toHaveBeenCalledTimes(1);
    await expect(
      service.queueNotification({ ...event, recipientId: 'invalid' })
    ).rejects.toBeDefined();
    await expect(
      service.queueNotification({ ...event, type: 'unknown' })
    ).rejects.toBeDefined();
    await service.onModuleDestroy();
  });
});
