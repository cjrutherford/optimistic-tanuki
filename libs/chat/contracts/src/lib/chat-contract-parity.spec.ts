import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ChatCommands } from '../index';
import {
  ConversationDto,
  ConversationType,
  CreateCommunityChatDto,
  GetConversationDto,
  GetConversationsDto,
  GetMessagesDto,
  GetOrCreateDirectChatDto,
  GetOrCreateProjectChatDto,
} from './conversation';
import { PostMessageDto, SendMessageDto } from './chat-message';

/**
 * TCP patterns with a live sender (gateway and/or AI orchestrator) and a live
 * chat-collector handler. Each entry pairs the pattern with its contract DTO
 * plus one valid and one invalid sample.
 */
const COVERED: Array<{
  pattern: string;
  dto: new () => object;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidProps: string[];
}> = [
  {
    pattern: ChatCommands.POST_MESSAGE,
    dto: PostMessageDto,
    valid: {
      conversationId: 'conv-1',
      senderId: 'profile-1',
      content: 'Hello',
      recipientIds: ['profile-2'],
      type: 'chat',
    },
    invalid: { conversationId: 'conv-1' },
    invalidProps: ['senderId', 'content', 'recipientIds', 'type'],
  },
  {
    pattern: ChatCommands.SEND_MESSAGE,
    dto: SendMessageDto,
    valid: {
      conversationId: 'conv-1',
      content: 'Hello',
      recipientIds: ['profile-2'],
    },
    invalid: { conversationId: 'conv-1', content: 'Hello' },
    invalidProps: ['recipientIds'],
  },
  {
    pattern: ChatCommands.GET_CONVERSATIONS,
    dto: GetConversationsDto,
    valid: { profileId: 'profile-1' },
    invalid: {},
    invalidProps: ['profileId'],
  },
  {
    pattern: ChatCommands.GET_CONVERSATION,
    dto: GetConversationDto,
    valid: { conversationId: 'conv-1' },
    invalid: {},
    invalidProps: ['conversationId'],
  },
  {
    pattern: ChatCommands.GET_MESSAGES,
    dto: GetMessagesDto,
    valid: { conversationId: 'conv-1', requestingProfileId: 'profile-1' },
    invalid: {},
    invalidProps: ['conversationId'],
  },
  {
    pattern: ChatCommands.GET_OR_CREATE_DIRECT_CHAT,
    dto: GetOrCreateDirectChatDto,
    valid: { participantIds: ['profile-1', 'profile-2'] },
    invalid: { participantIds: ['only-one'] },
    invalidProps: ['participantIds'],
  },
  {
    pattern: ChatCommands.CREATE_COMMUNITY_CHAT,
    dto: CreateCommunityChatDto,
    valid: { communityId: 'community-1', ownerId: 'profile-1' },
    invalid: { communityId: 'community-1' },
    invalidProps: ['ownerId'],
  },
  {
    pattern: ChatCommands.GET_OR_CREATE_PROJECT_CHAT,
    dto: GetOrCreateProjectChatDto,
    valid: {
      projectId: 'project-1',
      ownerId: 'profile-1',
      participants: ['profile-1', 'profile-2'],
    },
    invalid: { projectId: 'project-1', ownerId: 'profile-1' },
    invalidProps: ['participants'],
  },
];

/**
 * Declared `ChatCommands` with no implementation and no caller (see
 * `apps/chat-collector/src/app/app.service.ts` — community membership was never
 * built). Listed here so the gap is explicit: adding a caller or handler must
 * add a DTO above and move the key into COVERED.
 */
const KNOWN_UNIMPLEMENTED = [
  'ADD_TO_COMMUNITY_CHAT',
  'REMOVE_FROM_COMMUNITY_CHAT',
  'CREATE_ADDITIONAL_CHAT_ROOM',
];

const propsOf = (errors: ValidationError[]) =>
  errors.map((e) => e.property).sort();

describe('chat-contract-parity', () => {
  it.each(COVERED.map((c) => [c.pattern, c]))(
    'pattern %s validates its DTO both ways',
    async (_pattern, entry) => {
      const valid = plainToInstance(entry.dto, entry.valid);
      expect(await validate(valid)).toEqual([]);
      const invalid = plainToInstance(entry.dto, entry.invalid);
      expect(propsOf(await validate(invalid))).toEqual(
        [...entry.invalidProps].sort()
      );
    }
  );

  it('covers every implemented ChatCommands key and names the gaps', () => {
    const commandValues = new Set(Object.values(ChatCommands));
    const coveredValues = new Set(COVERED.map((c) => c.pattern));
    const expected = new Set([
      ...coveredValues,
      ...KNOWN_UNIMPLEMENTED.map(
        (k) => (ChatCommands as Record<string, string>)[k]
      ),
    ]);
    expect(commandValues).toEqual(expected);
    for (const key of KNOWN_UNIMPLEMENTED) {
      expect(
        coveredValues.has((ChatCommands as Record<string, string>)[key])
      ).toBe(false);
    }
  });

  it('ConversationDto round-trips the canonical read shape', async () => {
    const dto = plainToInstance(ConversationDto, {
      id: 'conv-1',
      title: 'Direct Chat',
      type: ConversationType.DIRECT,
      participants: ['profile-1', 'profile-2'],
    });
    expect(await validate(dto)).toEqual([]);
  });
});
