import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageListComponent } from './message-list.component';

describe('MessageListComponent', () => {
  let component: MessageListComponent;
  let fixture: ComponentFixture<MessageListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return contact by senderId', () => {
    const mockContacts = [
      { id: '1', name: 'John', avatarUrl: '', lastMessage: '', lastMessageTime: '' },
      { id: '2', name: 'Jane', avatarUrl: '', lastMessage: '', lastMessageTime: '' },
    ];
    component.contacts = mockContacts;
    expect(component.getContact('1')).toEqual(mockContacts[0]);
  });

  it('should return undefined if contact not found', () => {
    component.contacts = [];
    expect(component.getContact('99')).toBeUndefined();
  });
});