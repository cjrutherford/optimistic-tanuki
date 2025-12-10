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

  it('should emit bubbleClicked when clicked', () => {
    jest.spyOn(component.bubbleClicked, 'emit');
    component.onClick();
    expect(component.bubbleClicked.emit).toHaveBeenCalled();
  });

  it('should not show badge when unreadCount is 0', () => {
    component.unreadCount.set(0);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge).toBeFalsy();
  });

  it('should show badge when unreadCount is greater than 0', () => {
    component.unreadCount.set(3);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('3');
  });
});
