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

  it('should show menu when clicked', () => {
    expect(component.showMenu()).toBe(false);
    component.onClick();
    expect(component.showMenu()).toBe(true);
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

  it('should handle persona selection', () => {
    const mockPersona: any = { id: 'p1', name: 'Persona 1' };
    const emitSpy = jest.spyOn(component.personaSelected, 'emit');
    component.showMenu.set(true);

    component.onPersonaSelected(mockPersona);

    expect(component.showMenu()).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith(mockPersona);
  });

  it('should handle menu close', () => {
    component.showMenu.set(true);
    component.onMenuClose();
    expect(component.showMenu()).toBe(false);
  });
});
