import { generateDeletionWriteFenceSql } from '@optimistic-tanuki/storage';
export const classifiedsDeletionFenceSql = () =>
  generateDeletionWriteFenceSql([
    {
      table: 'classified_ad',
      identities: [
        { column: 'userId', kind: 'account' },
        { column: 'profileId', kind: 'profile' },
      ],
    },
  ]);
