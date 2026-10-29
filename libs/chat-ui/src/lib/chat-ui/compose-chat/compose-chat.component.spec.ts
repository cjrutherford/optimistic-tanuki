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
    const submissions: Array<{ settle: (accepted: boolean) => void }> = [];
    component.submissionRequested.subscribe((submission) =>
      submissions.push(submission)
    );

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(event, 'shiftKey', { value: false });
    const preventDefault = jest.fn();
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    component.onEditorKeydown(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(component.messageSubmitted.emit).toHaveBeenCalledWith('Hello world');
    expect(component.content).toBe('Hello world');
    expect(component.pendingSubmission).toBe(true);
    submissions[0].settle(true);
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

  it('keeps a rejected draft and clears it only after an accepted retry', () => {
    component.content = 'recover me';
    const submissions: Array<{ settle: (accepted: boolean) => void }> = [];
    component.submissionRequested.subscribe((submission) =>
      submissions.push(submission)
    );

    component.submitMessage();
    expect(component.pendingSubmission).toBe(true);
    expect(component.content).toBe('recover me');

    submissions[0].settle(false);
    expect(component.pendingSubmission).toBe(false);
    expect(component.content).toBe('recover me');
    expect(component.submissionError).toContain('draft is still here');

    component.submitMessage();
    expect(component.pendingSubmission).toBe(true);
    submissions[1].settle(true);
    expect(component.content).toBe('');
    expect(component.submissionError).toBeNull();
  });

  it('blocks double activation while pending and does not clear a newer draft on late ack', () => {
    component.content = 'first draft';
    const submissions: Array<{ settle: (accepted: boolean) => void }> = [];
    component.submissionRequested.subscribe((submission) =>
      submissions.push(submission)
    );

    component.submitMessage();
    component.submitMessage();
    expect(submissions).toHaveLength(1);

    component.content = 'newer draft';
    submissions[0].settle(true);
    expect(component.content).toBe('newer draft');
  });
});
