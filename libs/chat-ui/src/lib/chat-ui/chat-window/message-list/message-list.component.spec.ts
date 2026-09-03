import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageListComponent } from './message-list.component';

describe('MessageListComponent', () => {
  let fixture: ComponentFixture<MessageListComponent>;
  let component: MessageListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageListComponent);
    component = fixture.componentInstance;
  });

  it('renders sender names from participant profiles in the message list', () => {
    component.currentUserId = 'profile-1';
    component.contacts = [
      { id: 'profile-2', name: 'Member Two', profilePic: 'two.png' },
    ];
    component.messages = [
      {
        id: 'm1',
        conversationId: 'room-1',
        senderId: 'profile-2',
        recipientId: ['profile-1'],
        content: 'hello',
        timestamp: new Date('2026-07-05T10:03:00.000Z'),
        type: 'chat',
      },
    ];

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Member Two');
    expect(fixture.nativeElement.textContent).toContain('hello');
  });

  describe('getMessageContent', () => {
    it('strips HTML tags from message content', () => {
      expect(component.getMessageContent('<b>bold</b> text')).toBe('bold text');
    });
  });

  describe('getContact', () => {
    it('returns a contact built from the conversation participant profile when present', () => {
      component.conversation = {
        id: 'conv-1',
        participantProfiles: [
          {
            id: 'p1',
            name: 'Profile One',
            profilePic: 'pic.png',
            avatarUrl: 'avatar.png',
          },
        ],
      } as any;

      const result = component.getContact('p1');

      expect(result).toEqual({
        id: 'p1',
        name: 'Profile One',
        profilePic: 'pic.png',
        avatarUrl: 'avatar.png',
      });
    });

    it('falls back to the contacts list when no participant profile matches', () => {
      component.conversation = { id: 'conv-1' } as any;
      component.contacts = [{ id: 'p2', name: 'Contact Two' }];

      const result = component.getContact('p2');

      expect(result).toEqual({ id: 'p2', name: 'Contact Two' });
    });

    it('returns undefined when no contact matches at all', () => {
      component.conversation = undefined;
      component.contacts = [];

      expect(component.getContact('unknown')).toBeUndefined();
    });
  });

  describe('isReceived / isSent', () => {
    it('identifies received vs sent messages by current user id', () => {
      component.currentUserId = 'user-1';
      expect(component.isReceived('user-2')).toBe(true);
      expect(component.isReceived('user-1')).toBe(false);
      expect(component.isSent('user-1')).toBe(true);
      expect(component.isSent('user-2')).toBe(false);
    });
  });

  describe('isReadBy', () => {
    it('returns true when the contact is in readBy', () => {
      const message = { readBy: ['c1', 'c2'] } as any;
      expect(component.isReadBy(message, 'c1')).toBe(true);
    });

    it('returns false when readBy is missing or does not include the contact', () => {
      expect(component.isReadBy({} as any, 'c1')).toBe(false);
      expect(component.isReadBy({ readBy: ['c2'] } as any, 'c1')).toBe(false);
    });
  });

  describe('getMessageStatusClass', () => {
    beforeEach(() => {
      component.currentUserId = 'user-1';
    });

    it('returns status-system for system messages', () => {
      expect(component.getMessageStatusClass({ type: 'system' } as any)).toBe(
        'status-system'
      );
    });

    it('returns status-deleted for deleted messages', () => {
      expect(component.getMessageStatusClass({ isDeleted: true } as any)).toBe(
        'status-deleted'
      );
    });

    it('returns status-read for sent messages that have been read', () => {
      expect(
        component.getMessageStatusClass({
          senderId: 'user-1',
          readBy: ['user-2'],
        } as any)
      ).toBe('status-read');
    });

    it('returns status-sent for sent messages with no reads', () => {
      expect(
        component.getMessageStatusClass({
          senderId: 'user-1',
          readBy: [],
        } as any)
      ).toBe('status-sent');
    });

    it('returns status-delivered for received messages', () => {
      expect(
        component.getMessageStatusClass({ senderId: 'user-2' } as any)
      ).toBe('status-delivered');
    });
  });

  describe('hasReactions / getReactionsByEmoji', () => {
    it('reports no reactions when none are present', () => {
      expect(component.hasReactions({} as any)).toBe(false);
      expect(component.getReactionsByEmoji({} as any)).toEqual([]);
    });

    it('groups reactions by emoji and flags the current user as active', () => {
      component.currentUserId = 'user-1';
      const message = {
        reactions: [
          { emoji: '👍', userId: 'user-1' },
          { emoji: '👍', userId: 'user-2' },
          { emoji: '❤️', userId: 'user-3' },
        ],
      } as any;

      expect(component.hasReactions(message)).toBe(true);
      expect(component.getReactionsByEmoji(message)).toEqual([
        { emoji: '👍', count: 2, users: ['user-1', 'user-2'], isActive: true },
        { emoji: '❤️', count: 1, users: ['user-3'], isActive: false },
      ]);
    });
  });

  describe('emoji picker and reactions', () => {
    it('toggles the emoji picker for a message', () => {
      component.toggleEmojiPicker('m1');
      expect(component.showEmojiPicker['m1']).toBe(true);
      component.toggleEmojiPicker('m1');
      expect(component.showEmojiPicker['m1']).toBe(false);
    });

    it('emits reactionAdded and closes the picker', () => {
      const spy = jest.spyOn(component.reactionAdded, 'emit');
      component.showEmojiPicker['m1'] = true;
      component.addReaction('m1', '👍');
      expect(spy).toHaveBeenCalledWith({ messageId: 'm1', emoji: '👍' });
      expect(component.showEmojiPicker['m1']).toBe(false);
    });

    it('emits reactionRemoved', () => {
      const spy = jest.spyOn(component.reactionRemoved, 'emit');
      component.removeReaction('m1', '👍');
      expect(spy).toHaveBeenCalledWith({ messageId: 'm1', emoji: '👍' });
    });
  });

  describe('getContactName', () => {
    it('returns the contact name when found', () => {
      component.contacts = [{ id: 'c1', name: 'Contact One' }];
      expect(component.getContactName('c1')).toBe('Contact One');
    });

    it('returns Unknown when no contact matches', () => {
      component.contacts = [];
      expect(component.getContactName('missing')).toBe('Unknown');
    });
  });

  describe('isTyping', () => {
    it('reflects whether the user is in the typingUsers list', () => {
      component.typingUsers = ['user-1'];
      expect(component.isTyping('user-1')).toBe(true);
      expect(component.isTyping('user-2')).toBe(false);
    });
  });

  describe('isFirstInGroup / isLastInGroup', () => {
    const messages = [
      { senderId: 'a' },
      { senderId: 'a' },
      { senderId: 'b' },
    ] as any;

    it('identifies the first message in a sender group', () => {
      expect(component.isFirstInGroup(messages, 0)).toBe(true);
      expect(component.isFirstInGroup(messages, 1)).toBe(false);
      expect(component.isFirstInGroup(messages, 2)).toBe(true);
    });

    it('identifies the last message in a sender group', () => {
      expect(component.isLastInGroup(messages, 0)).toBe(false);
      expect(component.isLastInGroup(messages, 1)).toBe(true);
      expect(component.isLastInGroup(messages, 2)).toBe(true);
    });
  });
});
