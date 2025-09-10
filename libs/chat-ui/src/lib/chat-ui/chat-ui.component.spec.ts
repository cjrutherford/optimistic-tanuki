import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatUiComponent } from './chat-ui.component';
import { SimpleChange, SimpleChanges } from '@angular/core';

describe('ChatUiComponent', () => {
  let component: ChatUiComponent;
  let fixture: ComponentFixture<ChatUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call syncWindowStates on ngOnInit', () => {
    const syncSpy = jest.spyOn(component as any, 'syncWindowStates');
    component.ngOnInit();
    expect(syncSpy).toHaveBeenCalled();
  });

  it('should call syncWindowStates on ngOnChanges when contacts change', () => {
    const syncSpy = jest.spyOn(component as any, 'syncWindowStates');
    const changes: SimpleChanges = {
      contacts: new SimpleChange(undefined, [{ id: '4', name: 'Test', avatarUrl: '', lastMessage: '', lastMessageTime: '' }], true)
    };
    component.ngOnChanges(changes);
    expect(syncSpy).toHaveBeenCalled();
  });

  it('should call syncWindowStates on ngOnChanges when conversations change', () => {
    const syncSpy = jest.spyOn(component as any, 'syncWindowStates');
    const changes: SimpleChanges = {
      conversations: new SimpleChange(undefined, new Map(), true)
    };
    component.ngOnChanges(changes);
    expect(syncSpy).toHaveBeenCalled();
  });

  it('should initialize windowStates with existing contacts', () => {
    component.contacts = [{ id: 'test1', name: 'Test1', avatarUrl: '', lastMessage: '', lastMessageTime: '' }];
    component.conversations.set('test1', []);
    (component as any).syncWindowStates();
    expect(component.windowStates()['test1']).toBeDefined();
    expect(component.windowStates()['test1'].windowState).toBe('hidden');
  });

  it('should not overwrite existing windowState', () => {
    component.contacts = [{ id: 'test1', name: 'Test1', avatarUrl: '', lastMessage: '', lastMessageTime: '' }];
    component.conversations.set('test1', []);
    component.windowStates.set({ 'test1': { windowState: 'popout', conversation: [] } });
    (component as any).syncWindowStates();
    expect(component.windowStates()['test1'].windowState).toBe('popout');
  });

  it('should open chat window to popout state', () => {
    component.contacts = [{ id: 'test1', name: 'Test1', avatarUrl: '', lastMessage: '', lastMessageTime: '' }];
    component.conversations.set('test1', []);
    (component as any).syncWindowStates();
    component.openChat('test1');
    expect(component.windowStates()['test1'].windowState).toBe('popout');
  });

  it('should handle window state change', () => {
    component.contacts = [{ id: 'test1', name: 'Test1', avatarUrl: '', lastMessage: '', lastMessageTime: '' }];
    component.conversations.set('test1', []);
    (component as any).syncWindowStates();
    component.handleWindowStateChange('test1', 'hidden');
    expect(component.windowStates()['test1'].windowState).toBe('hidden');
  });

  it('should not change state for non-existent contact', () => {
    const initialStates = { ...component.windowStates() };
    component.handleWindowStateChange('nonExistent', 'hidden');
    expect(component.windowStates()).toEqual(initialStates);
  });

  it('should return constructed conversation contacts', () => {
    const profiles = [{ id: '1', profileName: 'Test User', profilePic: '', userId: '', coverPic: '', bio: '', location: '', occupation: '', interests: '', skills: '', created_at: new Date() }];
    const messages = [{ id: '1', conversationId: '1', senderId: '1', recipientId: ['2'], content: 'Hello', timestamp: new Date(), type: 'chat' as const }];
    const result = component.getConversationContacts(profiles, messages);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Test User');
  });
});
