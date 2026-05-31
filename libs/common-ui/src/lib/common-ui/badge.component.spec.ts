import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeComponent } from './badge.component';

describe('BadgeComponent', () => {
  let component: BadgeComponent;
  let fixture: ComponentFixture<BadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function rootEl(): HTMLElement {
    return fixture.nativeElement.querySelector('.badge');
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to neutral tone, soft shape, md size', () => {
    expect(rootEl().getAttribute('data-tone')).toBe('neutral');
    expect(rootEl().getAttribute('data-shape')).toBe('soft');
    expect(rootEl().getAttribute('data-size')).toBe('md');
  });

  it('reflects tone/shape/size as data attributes', () => {
    component.tone = 'success';
    component.shape = 'outline';
    component.size = 'lg';
    fixture.detectChanges();
    expect(rootEl().getAttribute('data-tone')).toBe('success');
    expect(rootEl().getAttribute('data-shape')).toBe('outline');
    expect(rootEl().getAttribute('data-size')).toBe('lg');
  });

  it('maps deprecated variant inputs to tone', () => {
    component.variant = 'primary';
    fixture.detectChanges();
    expect(component.tone).toBe('brand');
    expect(rootEl().getAttribute('data-tone')).toBe('brand');

    component.variant = 'error';
    fixture.detectChanges();
    // 'tone' was already non-neutral, so subsequent variant set should NOT
    // overwrite it. This preserves the explicit-tone-wins contract.
    expect(component.tone).toBe('brand');
  });

  it('uses variant on fresh instance when tone has not been customized', () => {
    const fresh = TestBed.createComponent(BadgeComponent);
    fresh.componentInstance.variant = 'warning';
    fresh.detectChanges();
    expect(fresh.componentInstance.tone).toBe('warning');
    expect(
      (fresh.nativeElement.querySelector('.badge') as HTMLElement).getAttribute(
        'data-tone'
      )
    ).toBe('warning');
  });
});
