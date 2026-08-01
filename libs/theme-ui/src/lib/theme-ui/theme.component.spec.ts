import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeToggleComponent } from './theme.component';

describe('ToggleComponent', () => {
  let component: ThemeToggleComponent;
  let fixture: ComponentFixture<ThemeToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens and closes the compact appearance menu', () => {
    expect(component.showControls).toBe(false);

    component.toggleControls();
    expect(component.showControls).toBe(true);

    component.closeControls();
    expect(component.showControls).toBe(false);
  });

  it('closes appearance controls when Escape is pressed', () => {
    component.showControls = true;

    component.handleEscape();

    expect(component.showControls).toBe(false);
  });

  it('opens the appearance menu from its trigger', () => {
    const trigger = fixture.nativeElement.querySelector(
      '.appearance-trigger'
    ) as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();

    expect(component.showControls).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the rendered appearance menu from its close button', () => {
    component.showControls = true;
    fixture.detectChanges();

    const closeButton = document.querySelector(
      '.appearance-close'
    ) as HTMLButtonElement;
    expect(closeButton).toBeTruthy();

    closeButton.click();
    fixture.detectChanges();

    expect(component.showControls).toBe(false);
  });
});
