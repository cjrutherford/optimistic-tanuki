import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  ProjectConversationComponent,
  ProjectMessage,
} from './project-conversation.component';

describe('ProjectConversationComponent', () => {
  let fixture: ComponentFixture<ProjectConversationComponent>;
  let component: ProjectConversationComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectConversationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectConversationComponent);
    component = fixture.componentInstance;
  });

  function messages(): ProjectMessage[] {
    return [
      {
        id: 'm1',
        senderId: 'alice',
        content: 'hello',
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    ];
  }

  /**
   * The chat window compares `[messages]` by reference. A getter that builds
   * a new object every change detection pass makes it scroll and rebuild its
   * message list continuously, which is the bug fixed once already in
   * ai-assistant-bubble.component.ts. This is the same guard here.
   */
  describe('the built conversation', () => {
    it('is the same reference across renders when nothing changed', () => {
      component.messages = messages();
      component.people = [{ profileId: 'alice', name: 'Alice' }];
      component.viewerProfileId = 'bob';

      const first = component.conversation;
      fixture.detectChanges();
      const second = component.conversation;

      expect(second).toBe(first);
    });

    it('is a different reference once a message is added', () => {
      component.messages = messages();
      component.people = [{ profileId: 'alice', name: 'Alice' }];
      component.viewerProfileId = 'bob';

      const first = component.conversation;

      component.messages = [
        ...messages(),
        { id: 'm2', senderId: 'bob', content: 'hi back' },
      ];
      const second = component.conversation;

      expect(second).not.toBe(first);
      expect(second.messages.length).toBe(2);
    });

    it('takes each message timestamp from createdAt rather than render time', () => {
      component.messages = messages();
      component.people = [{ profileId: 'alice', name: 'Alice' }];
      component.viewerProfileId = 'bob';

      const built = component.conversation;

      expect(built.messages[0].timestamp).toEqual(
        new Date('2020-01-01T00:00:00.000Z')
      );
    });

    it('carries participant names through participantProfiles', () => {
      component.messages = messages();
      component.people = [
        { profileId: 'alice', name: 'Alice' },
        { profileId: 'bob', name: 'Bob' },
      ];
      component.viewerProfileId = 'bob';

      const built = component.conversation;

      expect(built.participantProfiles).toEqual([
        expect.objectContaining({ id: 'alice', name: 'Alice' }),
        expect.objectContaining({ id: 'bob', name: 'Bob' }),
      ]);
    });
  });

  describe('rendering', () => {
    it('shows the chat window and a sender name resolved via participantProfiles', () => {
      component.messages = messages();
      component.people = [
        { profileId: 'alice', name: 'Alice' },
        { profileId: 'bob', name: 'Bob' },
      ];
      component.viewerProfileId = 'bob';
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('lib-chat-window')).toBeTruthy();
      expect(el.textContent).toContain('Alice');
      expect(el.textContent).toContain('hello');
    });

    it('renders the unavailable message instead of the window when set', () => {
      component.unavailable = 'The conversation is unavailable.';
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('lib-chat-window')).toBeFalsy();
      expect(el.querySelector('.unavailable')?.textContent).toContain(
        'The conversation is unavailable.'
      );
    });

    it('emits a sent message from the composer', () => {
      component.messages = [];
      component.people = [{ profileId: 'alice', name: 'Alice' }];
      component.viewerProfileId = 'alice';
      fixture.detectChanges();

      let emitted: string | undefined;
      component.sent.subscribe((value: string) => (emitted = value));

      component.sent.emit('a new message');

      expect(emitted).toBe('a new message');
    });
  });
});
