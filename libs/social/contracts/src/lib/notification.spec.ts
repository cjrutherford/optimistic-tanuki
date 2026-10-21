import { notificationTemplate, projectNotification } from './notification';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const recipientId = '123e4567-e89b-42d3-a456-426614174001';

describe('projectNotification', () => {
  it('projects only canonical identity and server-owned safe fields', () => {
    const result = projectNotification({
      id: uuid.toUpperCase(),
      recipientId: recipientId.toUpperCase(),
      type: 'mention',
      title: 'forged title',
      body: 'https://attacker.example/path',
      senderId: 'attacker',
      resourceType: 'post',
      resourceId: 'secret',
      actionUrl: 'https://attacker.example',
      isRead: true,
      createdAt: '2025-01-02T03:04:05.000Z',
      extra: 'discard me',
    });

    expect(result).toEqual({
      id: uuid,
      recipientId,
      type: 'mention',
      title: 'You were mentioned',
      body: 'Someone mentioned you in a post',
      isRead: true,
      createdAt: '2025-01-02T03:04:05.000Z',
    });
    expect(Object.keys(result!)).toEqual([
      'id',
      'recipientId',
      'type',
      'title',
      'body',
      'isRead',
      'createdAt',
    ]);
  });

  it('maps unknown legacy types to system and rejects malformed rows', () => {
    expect(
      projectNotification({
        id: uuid,
        recipientId,
        type: 'unknown-legacy',
        title: 'external URL https://evil.example',
        body: 'untrusted historical body',
        isRead: false,
        createdAt: new Date('2025-01-02T03:04:05.000Z'),
      })
    ).toMatchObject({
      type: 'system',
      title: 'Notification',
      body: 'You have a new notification',
    });

    expect(projectNotification(null)).toBeNull();
    expect(
      projectNotification({ id: 'bad', recipientId, type: 'like' })
    ).toBeNull();
    expect(
      projectNotification({
        id: uuid,
        recipientId: 'bad',
        type: 'like',
        isRead: false,
        createdAt: '2025-01-02T03:04:05.000Z',
      })
    ).toBeNull();
  });

  it('returns deterministic templates for the known allowlist', () => {
    for (const type of [
      'like',
      'comment',
      'follow',
      'mention',
      'message',
      'community_invite',
      'system',
    ]) {
      const template = notificationTemplate(type);
      expect(template.title).toBeTruthy();
      expect(template.body).toBeTruthy();
    }
    expect(notificationTemplate('like')).toEqual(notificationTemplate('like'));
  });
});
