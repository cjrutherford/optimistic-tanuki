import { constructConversation, filterContactsByConversation, profileDtoToChatContact } from './index';

import { ChatMessage } from '../types/message';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

describe('Utils', () => {
  describe('profileDtoToChatContact', () => {
    it('should convert ProfileDto to ChatContact', () => {
      const profile: ProfileDto = {
        id: '1',
        profileName: 'Test User',
        profilePic: 'http://example.com/pic.jpg',
        userId: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        created_at: new Date(),
      };
      const chatContact = profileDtoToChatContact(profile);
      expect(chatContact).toEqual({
        id: '1',
        name: 'Test User',
        avatarUrl: 'http://example.com/pic.jpg',
        lastMessage: '',
        lastMessageTime: '',
      });
    });

    it('should use placeholder for avatarUrl if profilePic is null', () => {
      const profile: ProfileDto = {
        id: '1',
        profileName: 'Test User',
        profilePic: '',
        userId: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        created_at: new Date(),
      };
      const chatContact = profileDtoToChatContact(profile);
      expect(chatContact.avatarUrl).toBe('https://placehold.co/60x60');
    });

    it('should use placeholder for avatarUrl if profilePic is undefined', () => {
      const profile: ProfileDto = {
        id: '1',
        profileName: 'Test User',
        userId: '',
        coverPic: '',
        profilePic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        created_at: new Date(),
      };
      const chatContact = profileDtoToChatContact(profile);
      expect(chatContact.avatarUrl).toBe('https://placehold.co/60x60');
    });
  });

  describe('filterContactsByConversation', () => {
    const contacts = [
      { id: '1', name: 'User1', avatarUrl: '', lastMessage: '', lastMessageTime: '' },
      { id: '2', name: 'User2', avatarUrl: '', lastMessage: '', lastMessageTime: '' },
      { id: '3', name: 'User3', avatarUrl: '', lastMessage: '', lastMessageTime: '' },
    ];

    it('should filter contacts based on senderId and recipientId', () => {
      const messages: ChatMessage[] = [
        { id: 'm1', conversationId: 'c1', senderId: '1', recipientId: ['2'], content: 'hi', timestamp: new Date(), type: 'chat' },
        { id: 'm2', conversationId: 'c1', senderId: '2', recipientId: ['1'], content: 'hello', timestamp: new Date(), type: 'chat' },
      ];
      const filtered = filterContactsByConversation(contacts, messages);
      expect(filtered.length).toBe(2);
      expect(filtered.some(c => c.id === '1')).toBeTruthy();
      expect(filtered.some(c => c.id === '2')).toBeTruthy();
      expect(filtered.some(c => c.id === '3')).toBeFalsy();
    });

    it('should handle single recipientId', () => {
      const messages: ChatMessage[] = [
        { id: 'm1', conversationId: 'c1', senderId: '1', recipientId: ['2'], content: 'hi', timestamp: new Date(), type: 'chat' },
      ];
      const filtered = filterContactsByConversation(contacts, messages);
      expect(filtered.length).toBe(2);
      expect(filtered.some(c => c.id === '1')).toBeTruthy();
      expect(filtered.some(c => c.id === '2')).toBeTruthy();
    });

    it('should return empty array if no messages', () => {
      const messages: ChatMessage[] = [];
      const filtered = filterContactsByConversation(contacts, messages);
      expect(filtered.length).toBe(0);
    });

    it('should return empty array if no contacts', () => {
      const messages: ChatMessage[] = [
        { id: 'm1', conversationId: 'c1', senderId: '1', recipientId: ['2'], content: 'hi', timestamp: new Date(), type: 'chat' },
      ];
      const filtered = filterContactsByConversation([], messages);
      expect(filtered.length).toBe(0);
    });
  });

  describe('constructConversation', () => {
    const profiles: ProfileDto[] = [
      {
        id: '1',
        profileName: 'User One',
        profilePic: 'pic1.jpg',
        userId: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        created_at: new Date(),
      },
      {
        id: '2',
        profileName: 'User Two',
        profilePic: 'pic2.jpg',
        userId: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        created_at: new Date(),
      },
    ];

    it('should construct conversation with last message details', () => {
      const messages: ChatMessage[] = [
        { id: 'm1', conversationId: 'c1', senderId: '1', recipientId: ['2'], content: 'Hello', timestamp: new Date('2023-01-01T10:00:00Z'), type: 'chat' },
        { id: 'm2', conversationId: 'c1', senderId: '2', recipientId: ['1'], content: 'Hi there', timestamp: new Date('2023-01-01T10:05:00Z'), type: 'chat' },
      ];
      const result = constructConversation(profiles, messages);
      expect(result.length).toBe(2);
      expect(result[0].lastMessage).toBe('Hi there');
      expect(result[0].lastMessageTime).toBe(messages[1].timestamp?.toString());
      expect(result[1].lastMessage).toBe('Hi there');
      expect(result[1].lastMessageTime).toBe(messages[1].timestamp?.toString());
    });

    it('should handle empty messages array', () => {
      const messages: ChatMessage[] = [];
      const result = constructConversation(profiles, messages);
      expect(result.length).toBe(0);
    });

    it('should handle last message sent by recipient', () => {
      const messages: ChatMessage[] = [
        { id: 'm1', conversationId: 'c1', senderId: '1', recipientId: ['2'], content: 'Hello', timestamp: new Date('2023-01-01T10:00:00Z'), type: 'chat' },
        { id: 'm2', conversationId: 'c1', senderId: '2', recipientId: ['1'], content: 'Reply', timestamp: new Date('2023-01-01T10:01:00Z'), type: 'chat' },
      ];
      const result = constructConversation(profiles, messages);
      expect(result.length).toBe(2);
      expect(result[0].lastMessage).toBe('Reply');
      expect(result[1].lastMessage).toBe('Reply');
    });

    it('should handle last message with multiple recipients', () => {
      const messages: ChatMessage[] = [
        { id: 'm1', conversationId: 'c1', senderId: '1', recipientId: ['2', '3'], content: 'Group chat', timestamp: new Date('2023-01-01T10:00:00Z'), type: 'chat' },
      ];
      const profilesWithThirdUser: ProfileDto[] = [
        ...profiles,
        {
          id: '3',
          profileName: 'User Three',
          profilePic: 'pic3.jpg',
          userId: '',
          coverPic: '',
          bio: '',
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          created_at: new Date(),
        },
      ];
      const result = constructConversation(profilesWithThirdUser, messages);
      expect(result.length).toBe(3);
      expect(result[0].lastMessage).toBe('Group chat');
      expect(result[1].lastMessage).toBe('Group chat');
      expect(result[2].lastMessage).toBe('Group chat');
    });

    it('should handle last message with non-array recipientId', () => {
      const messages: ChatMessage[] = [
        { id: 'm1', conversationId: 'c1', senderId: '1', recipientId: ['2'], content: 'Direct message', timestamp: new Date('2023-01-01T10:00:00Z'), type: 'chat' },
      ];
      const result = constructConversation(profiles, messages);
      expect(result.length).toBe(2);
      expect(result[0].lastMessage).toBe('Direct message');
      expect(result[1].lastMessage).toBe('Direct message');
    });

    it('should not set lastMessage if no lastMessage', () => {
      const messages: ChatMessage[] = [];
      const result = constructConversation(profiles, messages);
      expect(result.length).toBe(0);
    });
  });
});