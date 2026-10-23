import { CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import type { AccountExportPostgresSource } from '@optimistic-tanuki/storage';
import { ConversationType } from './entities/conversation.entity';
import { MessageType as ChatMessageType } from './entities/message.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown): string => {
  if (typeof value !== 'string' || !UUID.test(value))
    throw new Error('CHAT_EXPORT_INVALID_ID');
  return value.toLowerCase();
};
const text = (value: unknown, max: number): string => {
  if (typeof value !== 'string' || Array.from(value).length > max)
    throw new Error('CHAT_EXPORT_INVALID_TEXT');
  return value;
};
const timestamp = (value: unknown): string => {
  const raw = value instanceof Date ? value.toISOString() : value;
  if (
    typeof raw !== 'string' ||
    !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:?\d\d)?$/.test(
      raw
    )
  )
    throw new Error('CHAT_EXPORT_INVALID_TIMESTAMP');
  const date = new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`
  );
  if (!Number.isFinite(date.getTime()))
    throw new Error('CHAT_EXPORT_INVALID_TIMESTAMP');
  const fraction = raw.match(/\.(\d{1,6})(?:Z|[+-]\d\d:?\d\d)?$/)?.[1] ?? '';
  return date
    .toISOString()
    .replace(/Z$/, `${fraction.length > 3 ? fraction.slice(3) : ''}Z`);
};
const enumValue = <T extends string>(
  value: unknown,
  values: readonly T[]
): T => {
  if (
    typeof value !== 'string' ||
    !(values as readonly string[]).includes(value)
  )
    throw new Error('CHAT_EXPORT_UNKNOWN_ENUM');
  return value as T;
};
const boolean = (value: unknown): boolean => {
  if (typeof value !== 'boolean')
    throw new Error('CHAT_EXPORT_INVALID_BOOLEAN');
  return value;
};

export function createChatAccountExportSources(
  profileTable: string
): AccountExportPostgresSource[] {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(profileTable))
    throw new Error('CHAT_EXPORT_INVALID_PROFILE_TABLE');
  const conversations: AccountExportPostgresSource = {
    source: 'Conversation',
    sql: `SELECT r.id::text AS id,left(r.type::text,64) AS type,r."isDeleted" AS "isDeleted",r."createdAt"::text AS "createdAt",r."updatedAt"::text AS "updatedAt",EXISTS (SELECT 1 FROM unnest(r.participants) participant(id) JOIN "${profileTable}" identities ON lower(identities.id::text)=lower(participant.id)) AS "recordedParticipation",EXISTS (SELECT 1 FROM "${profileTable}" identities WHERE lower(identities.id::text)=lower(r."ownerId"::text)) AS "recordedStewardship",EXISTS (SELECT 1 FROM "message" m JOIN "${profileTable}" identities ON lower(identities.id::text)=lower(m."senderId"::text) WHERE m."conversationId"=r.id) AS "hasRecordedSentMessages" FROM "conversation" r WHERE (EXISTS (SELECT 1 FROM unnest(r.participants) participant(id) JOIN "${profileTable}" identities ON lower(identities.id::text)=lower(participant.id)) OR EXISTS (SELECT 1 FROM "${profileTable}" identities WHERE lower(identities.id::text)=lower(r."ownerId"::text)) OR EXISTS (SELECT 1 FROM "message" m JOIN "${profileTable}" identities ON lower(identities.id::text)=lower(m."senderId"::text) WHERE m."conversationId"=r.id) OR lower(r."ownerId"::text)=$1) AND ($2::text IS NULL OR r.id::text COLLATE "C">$2 COLLATE "C") ORDER BY r.id::text COLLATE "C" LIMIT $3`,
    project(row, account) {
      const accountId = id(account);
      const recordedParticipation = boolean(row.recordedParticipation);
      const recordedStewardship = boolean(row.recordedStewardship);
      const hasRecordedSentMessages = boolean(row.hasRecordedSentMessages);
      if (
        !recordedParticipation &&
        !recordedStewardship &&
        !hasRecordedSentMessages
      )
        throw new Error('CHAT_EXPORT_AMBIGUOUS_ACCOUNT_OWNER');
      // The account value is validated because it is a leased owner input; it is never emitted.
      void accountId;
      return {
        id: id(row.id),
        type: enumValue(row.type, Object.values(ConversationType)),
        isDeleted: boolean(row.isDeleted),
        createdAt: timestamp(row.createdAt),
        updatedAt: timestamp(row.updatedAt),
        recordedParticipation,
        recordedStewardship,
        hasRecordedSentMessages,
        attribution: 'recorded-unverified',
        consent: 'not-inferred',
        context: 'minimal-shared-conversation-context',
      };
    },
  };
  const messages: AccountExportPostgresSource = {
    source: 'Message',
    sql: `SELECT r.id::text AS id,left(r."senderId"::text,37) AS "senderId",r."conversationId"::text AS "conversationId",left(r.type::text,64) AS type,r."createdAt"::text AS "createdAt",r."updatedAt"::text AS "updatedAt",EXISTS (SELECT 1 FROM "conversation" parent WHERE parent.id=r."conversationId") AS "parentValid",CASE WHEN r.type::text='chat' THEN left(r.content,65537) ELSE NULL END AS content FROM "message" r WHERE $1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM "${profileTable}" identities WHERE lower(identities.id::text)=lower(r."senderId"::text)) AND ($2::text IS NULL OR r.id::text COLLATE "C">$2 COLLATE "C") ORDER BY r.id::text COLLATE "C" LIMIT $3`,
    project(row) {
      if (!boolean(row.parentValid))
        throw new Error('CHAT_EXPORT_ORPHAN_MESSAGE');
      const type = enumValue(row.type, Object.values(ChatMessageType));
      const result: Record<string, unknown> = {
        id: id(row.id),
        senderId: id(row.senderId),
        conversationId: id(row.conversationId),
        type,
        createdAt: timestamp(row.createdAt),
        updatedAt: timestamp(row.updatedAt),
        attribution: 'recorded-unverified',
        consent: 'not-inferred',
      };
      if (type === ChatMessageType.CHAT)
        result.content = text(row.content, 65536);
      else result.contentDisposition = 'excluded-generated-or-unverified-type';
      return result;
    },
  };
  const sources = [conversations, messages];
  if (
    sources.map((source) => source.source).join(',') !==
    CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES.join(',')
  )
    throw new Error('CHAT_EXPORT_SOURCE_ORDER_MISMATCH');
  return sources;
}
