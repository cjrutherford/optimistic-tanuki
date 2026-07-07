import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComposeChatComponent } from './compose-chat.component';

describe('ComposeChatComponent', () => {
  let component: ComposeChatComponent;
  let fixture: ComponentFixture<ComposeChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComposeChatComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ComposeChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('submits on Enter without Shift', () => {
    component.content = 'Hello world';
    jest.spyOn(component.messageSubmitted, 'emit');

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(event, 'shiftKey', { value: false });
    const preventDefault = jest.fn();
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    component.onEditorKeydown(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(component.messageSubmitted.emit).toHaveBeenCalledWith('Hello world');
    expect(component.content).toBe('');
  });

  it('inserts a paragraph break on Shift+Enter', () => {
    component.content = 'Hello world';

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
    });
    const preventDefault = jest.fn();
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    component.onEditorKeydown(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(component.content).toBe('Hello world\n\n');
  });

  it('serializes blank-line separated paragraphs on submit', () => {
    component.content = 'First paragraph\n\nSecond paragraph';
    jest.spyOn(component.messageSubmitted, 'emit');

    component.submitMessage();

    expect(component.messageSubmitted.emit).toHaveBeenCalledWith(
      'First paragraph\n\nSecond paragraph'
    );
  });

  it('does not emit when submit is called with blank content', () => {
    component.content = '   ';
    jest.spyOn(component.messageSubmitted, 'emit');

    component.submitMessage();

    expect(component.messageSubmitted.emit).not.toHaveBeenCalled();
  });
});
