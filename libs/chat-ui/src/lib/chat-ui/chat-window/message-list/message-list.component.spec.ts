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
});
