import { projectNotification } from '@optimistic-tanuki/social-contracts';
import { SocialCaptureSource } from './account-export-authored.sources';
import {
  accountMatch,
  captureInvalid,
  field as f,
  profileMatch,
  receiptSource,
} from './account-export-receipt.sources';

export const PERSONAL_SOURCES = [
  'SavedItem',
  'SearchHistory',
  'FollowEntity',
  'UserBlock',
  'UserMute',
  'Activity',
  'UserPresence',
  'ProfileView',
  'Notification',
] as const;
export function createPersonalSources(
  profileTable: string
): SocialCaptureSource[] {
  const owned = (column: string) => profileMatch(profileTable, column);
  return [
    receiptSource({
      source: 'SavedItem',
      table: 'saved_item',
      selector: owned('profileId'),
      fields: {
        profileId: f.uuid(),
        itemType: f.text(),
        itemId: f.ref(),
        savedAt: f.time(),
      },
    }),
    receiptSource({
      source: 'SearchHistory',
      table: 'search_history',
      selector: owned('profileId'),
      fields: {
        profileId: f.uuid(),
        query: f.text(),
        searchType: f.text(),
        resultCount: f.integer(),
        createdAt: f.time(),
      },
    }),
    receiptSource({
      source: 'FollowEntity',
      table: 'follow_entity',
      selector: owned('followerId'),
      fields: {
        followerId: f.uuid(),
        followeeId: f.ref(),
        appScope: f.text(true),
        createdAt: f.time(),
        updatedAt: f.time(),
      },
    }),
    receiptSource({
      source: 'UserBlock',
      table: 'user_block',
      selector: owned('blockerId'),
      fields: {
        blockerId: f.uuid(),
        blockedId: f.ref(),
        reason: f.text(true),
        createdAt: f.time(),
      },
    }),
    receiptSource({
      source: 'UserMute',
      table: 'user_mute',
      selector: owned('muterId'),
      fields: {
        muterId: f.uuid(),
        mutedId: f.ref(),
        duration: f.integer(true),
        createdAt: f.time(),
      },
    }),
    receiptSource({
      source: 'Activity',
      table: 'activity',
      selector: owned('profileId'),
      fields: {
        profileId: f.uuid(),
        type: f.text(),
        resourceId: f.ref(true),
        createdAt: f.time(),
      },
    }),
    receiptSource({
      source: 'UserPresence',
      table: 'user_presence',
      selector: accountMatch('userId'),
      fields: {
        userId: f.uuid(),
        status: f.text(),
        lastSeen: f.time(true),
        createdAt: f.time(),
        isExplicit: f.boolean(),
      },
      extraSelect: ['count(*) OVER ()::integer AS "bindingCount"'],
      transform: (data, row) => {
        if (row['bindingCount'] !== 1) captureInvalid();
        return data;
      },
    }),
    receiptSource({
      source: 'ProfileView',
      table: 'profile_view',
      selector: accountMatch('viewerId'),
      fields: {
        viewerId: f.uuid(),
        profileId: f.ref(true),
        source: f.text(),
        viewedAt: f.time(),
      },
      transform: (data) => ({
        ...data,
        source: ['direct', 'profile', 'search', 'feed', 'other'].includes(
          data['source'] as string
        )
          ? data['source']
          : 'other',
      }),
    }),
    receiptSource({
      source: 'Notification',
      table: 'notification',
      selector: owned('recipientId'),
      fields: {
        recipientId: f.uuid(),
        type: f.text(),
        isRead: f.boolean(),
        createdAt: f.time(),
      },
      transform: (data) => {
        const safe = projectNotification(data);
        if (!safe) captureInvalid();
        return { ...safe };
      },
    }),
  ];
}
