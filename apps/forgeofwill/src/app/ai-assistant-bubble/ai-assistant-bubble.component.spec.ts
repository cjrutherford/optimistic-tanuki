import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiAssistantBubbleComponent } from './ai-assistant-bubble.component';

describe('AiAssistantBubbleComponent', () => {
  let component: AiAssistantBubbleComponent;
  let fixture: ComponentFixture<AiAssistantBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiAssistantBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AiAssistantBubbleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('states that the assistant is unavailable without offering a creation action', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="status"]')?.textContent).toContain(
      'AI assistant unavailable'
    );
    expect(compiled.querySelector('button')).toBeNull();
  });
});
