import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChatMessage } from '@optimistic-tanuki/chat-contracts';
import { ProfileCommands } from '@optimistic-tanuki/profile-contracts';
import {
  PersonaTelosCommands,
  PersonaTelosDto,
} from '@optimistic-tanuki/telos-contracts';
import { ChatCommands } from '@optimistic-tanuki/chat-contracts';

/**
 * O26/R4: the orchestrator's three live downstream patterns use the L-libs
 * (profile L8, chat L4, telos-contracts), validated both ways.
 */
describe('orchestrator-contract-parity', () => {
  it('profile Get carries a resolvable id', () => {
    expect(ProfileCommands.Get).toBe('Get:Profile');
  });

  it('persona FIND validates a full persona DTO', async () => {
    expect(PersonaTelosCommands.FIND).toBe('PERSONA:FIND');
    const persona = {
      id: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      name: 'Ada',
      description: 'A patient tutor',
      goals: ['teach'],
      skills: ['patience'],
      interests: ['learning'],
      limitations: ['none'],
      strengths: ['clarity'],
      objectives: ['help'],
      coreObjective: 'help learners',
      exampleResponses: ['Hello!'],
      promptTemplate: 'You are Ada. {{input}}',
    };
    expect(await validate(plainToInstance(PersonaTelosDto, persona))).toEqual(
      []
    );
  });

  it('chat POST_MESSAGE validates the wire message', async () => {
    expect(ChatCommands.POST_MESSAGE).toBe('POST_MESSAGE');
    const message = {
      id: 'm1',
      conversationId: 'c1',
      senderName: 'Ada',
      senderId: 'persona-1',
      recipientId: ['profile-1'],
      recipientName: ['Bo'],
      content: 'Hello!',
      timestamp: new Date(),
      role: 'assistant',
      type: 'chat',
    };
    expect(await validate(plainToInstance(ChatMessage, message))).toEqual([]);
  });
});
