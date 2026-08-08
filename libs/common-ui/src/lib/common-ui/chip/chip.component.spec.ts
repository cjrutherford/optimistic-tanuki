import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChipComponent } from './chip.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('ChipComponent', () => {
  let component: ChipComponent;
  let fixture: ComponentFixture<ChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChipComponent],
      providers: [ThemeService],
    }).compileComponents();

    fixture = TestBed.createComponent(ChipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose canonical tone/emphasis/size axes with defaults', () => {
    expect(component.tone).toBe('brand');
    expect(component.emphasis).toBe('soft');
    expect(component.size).toBe('md');
  });

  it('should map legacy variant onto tone via the bridge', () => {
    component.variant = 'error';
    expect(component.tone).toBe('danger');

    component.variant = 'primary';
    expect(component.tone).toBe('brand');

    component.variant = 'secondary';
    expect(component.tone).toBe('neutral');
  });

  it('should render data-tone/emphasis/size on the chip element', () => {
    component.tone = 'success';
    component.emphasis = 'solid';
    component.size = 'lg';
    fixture.detectChanges();
    const chip: HTMLElement = fixture.nativeElement.querySelector('.chip');
    expect(chip.getAttribute('data-tone')).toBe('success');
    expect(chip.getAttribute('data-emphasis')).toBe('solid');
    expect(chip.getAttribute('data-size')).toBe('lg');
  });

  it('should emit delete when not disabled', () => {
    jest.spyOn(component.delete, 'emit');
    component.disabled = false;
    component.onDelete(new Event('click'));
    expect(component.delete.emit).toHaveBeenCalled();
  });

  it('should not emit delete when disabled', () => {
    jest.spyOn(component.delete, 'emit');
    component.disabled = true;
    component.onDelete(new Event('click'));
    expect(component.delete.emit).not.toHaveBeenCalled();
  });
});
