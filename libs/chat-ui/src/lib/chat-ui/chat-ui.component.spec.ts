import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatUiComponent } from './chat-ui.component';
import { By } from '@angular/platform-browser';
import { ChatWindowComponent } from './chat-window/chat-window.component';

describe('ChatUiComponent', () => {
  let fixture: ComponentFixture<ChatUiComponent>;
  let component: ChatUiComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatUiComponent);
    component = fixture.componentInstance;
  });

  it('mounts the selected conversation in the right pane', () => {
    component.contacts = [
      { id: 'room-1', name: 'General' },
      { id: 'room-2', name: 'Moderators' },
    ];
    component.conversations = [
      {
        id: 'room-1',
        participants: ['profile-1', 'profile-2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'room-2',
        participants: ['profile-1', 'profile-3'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    component.autoOpenFirstConversation = true;

    component.ngOnInit();
    fixture.detectChanges();

    const windows = fixture.nativeElement.querySelectorAll('lib-chat-window');
    expect(windows).toHaveLength(1);
    expect(component.getConversation('room-1').id).toBe('room-1');
  });

  it('replaces the mounted conversation when another channel is selected', () => {
    component.contacts = [
      { id: 'room-1', name: 'General' },
      { id: 'room-2', name: 'Moderators' },
    ];
    component.conversations = [
      {
        id: 'room-1',
        participants: ['profile-1', 'profile-2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'room-2',
        participants: ['profile-1', 'profile-3'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    component.autoOpenFirstConversation = true;

    component.ngOnInit();
    component.openChat('room-2');
    fixture.detectChanges();

    const windows = fixture.nativeElement.querySelectorAll('lib-chat-window');
    expect(windows).toHaveLength(1);
    expect(component.getConversation('room-2').id).toBe('room-2');
  });

  it('uses embedded window state when embedded layout is selected', () => {
    component.layout = 'embedded';
    component.contacts = [{ id: 'room-1', name: 'General' }];
    component.conversations = [
      {
        id: 'room-1',
        participants: ['profile-1', 'profile-2'],
        messages: [
          {
            id: 'm1',
            conversationId: 'room-1',
            senderId: 'profile-2',
            recipientId: ['profile-1'],
            content: 'hello',
            timestamp: new Date(),
            type: 'chat',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    component.autoOpenFirstConversation = true;

    component.ngOnInit();
    fixture.detectChanges();

    const windowComponent = fixture.debugElement.query(
      By.directive(ChatWindowComponent)
    ).componentInstance as ChatWindowComponent;

    expect(windowComponent.windowState).toBe('embedded');
    expect(fixture.nativeElement.textContent).toContain('hello');
  });

  it('renders a shared empty state when there are no contacts', () => {
    component.contacts = [];
    component.conversations = [];

    component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No conversations yet');
    expect(
      fixture.nativeElement.querySelector('otui-empty-state')
    ).not.toBeNull();
  });

  it('marks the messenger layout as mobile at small viewports', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });

    component.contacts = [{ id: 'room-1', name: 'General' }];
    component.conversations = [
      {
        id: 'room-1',
        participants: ['profile-1', 'profile-2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    component.ngOnInit();
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.messenger-container')
        ?.classList.contains('mobile-layout')
    ).toBe(true);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalWidth,
    });
  });

  it('keeps the default floating layout in popout state on mobile viewports', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });

    component.contacts = [{ id: 'room-1', name: 'General' }];
    component.conversations = [
      {
        id: 'room-1',
        participants: ['profile-1', 'profile-2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    component.ngOnInit();
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.messenger-container')
        ?.classList.contains('mobile-layout')
    ).toBe(true);
    expect(component.activeWindowState()).toBe('popout');

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalWidth,
    });
  });
});
