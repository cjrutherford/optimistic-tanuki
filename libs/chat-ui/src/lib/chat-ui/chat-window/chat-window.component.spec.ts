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
