import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatWindowComponent } from './chat-window.component';
import { By } from '@angular/platform-browser';

describe('ChatWindowComponent', () => {
  let component: ChatWindowComponent;
  let fixture: ComponentFixture<ChatWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatWindowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatWindowComponent);
    component = fixture.componentInstance;
  });

  it('shows group transport changes independently of participant presence', () => {
    component.contact = [{ id: 'room', name: 'Room' }];
    component.messages = {
      id: 'room',
      type: 'community',
      participants: ['self'],
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Connecting');
    component.connectionStatus = 'connected';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Connected');
    component.messages.participants.push('another');
    component.connectionStatus = 'reconnecting';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reconnecting');
    component.connectionStatus = 'connected';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Connected');
  });

  it('distinguishes unknown and offline direct presence', () => {
    component.contact = [{ id: 'person', name: 'Person' }];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unknown');
    component.contact = [{ id: 'person', name: 'Person', presence: 'offline' }];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Offline');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit windowStateChange with new state on onWindowStateChange', () => {
    jest.spyOn(component.windowStateChange, 'emit');
    component.onWindowStateChange('fullscreen');
    expect(component.windowState).toBe('fullscreen');
    expect(component.windowStateChange.emit).toHaveBeenCalledWith('fullscreen');
  });

  it('should emit windowStateChange with hidden state on onClose', () => {
    jest.spyOn(component.windowStateChange, 'emit');
    component.onClose();
    expect(component.windowState).toBe('hidden');
    expect(component.windowStateChange.emit).toHaveBeenCalledWith('hidden');
  });

  it('renders shared button controls for window actions', () => {
    component.contact = [{ id: 'room-1', name: 'General' }];
    component.windowState = 'popout';

    fixture.detectChanges();

    expect(
      fixture.debugElement.queryAll(By.css('.chat-window-actions otui-button'))
        .length
    ).toBe(2);
  });

  it('passes message and reaction events through from child components', () => {
    jest.spyOn(component.messageSubmitted, 'emit');
    jest.spyOn(component.reactionAdded, 'emit');
    jest.spyOn(component.reactionRemoved, 'emit');

    component.onMessageSubmitted('hello');
    component.onReactionAdded({ messageId: 'm1', emoji: '👍' });
    component.onReactionRemoved({ messageId: 'm1', emoji: '👍' });

    expect(component.messageSubmitted.emit).toHaveBeenCalledWith('hello');
    expect(component.reactionAdded.emit).toHaveBeenCalledWith({
      messageId: 'm1',
      emoji: '👍',
    });
    expect(component.reactionRemoved.emit).toHaveBeenCalledWith({
      messageId: 'm1',
      emoji: '👍',
    });
  });

  it('uses only the acknowledged submission path when a consumer opts in', () => {
    const legacy = jest.fn();
    const acknowledged = jest.fn();
    const settle = jest.fn();
    component.messageSubmitted.subscribe(legacy);
    component.messageSubmission.subscribe(acknowledged);

    component.onMessageSubmission({ content: 'hello', settle });

    expect(acknowledged).toHaveBeenCalledWith({ content: 'hello', settle });
    expect(legacy).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
  });

  it('keeps the legacy string event for consumers without an ack listener', () => {
    const legacy = jest.fn();
    const settle = jest.fn();
    component.messageSubmitted.subscribe(legacy);

    component.onMessageSubmission({ content: 'hello', settle });

    expect(legacy).toHaveBeenCalledWith('hello');
    expect(settle).toHaveBeenCalledWith(true);
  });

  it('marks the window as mobile at small viewports', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });

    component.windowState = 'popout';
    component.contact = [{ id: 'room-1', name: 'General' }];
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.chat-window-container')
        ?.classList.contains('mobile-window')
    ).toBe(true);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalWidth,
    });
  });

  it('does not trigger an expression changed error when mobile classes are applied on first render', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });

    component.windowState = 'popout';
    component.contact = [{ id: 'room-1', name: 'General' }];

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(
      fixture.nativeElement
        .querySelector('.chat-window-container')
        ?.classList.contains('mobile-window')
    ).toBe(true);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalWidth,
    });
  });
});
