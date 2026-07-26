import { TestBed } from '@angular/core/testing';

import { SectionSelectorComponent } from './section-selector.component';

describe('SectionSelectorComponent', () => {
  it('exposes a labelled modal and closes when Escape is pressed', () => {
    const closed = jest.fn();
    TestBed.configureTestingModule({ imports: [SectionSelectorComponent] });
    const fixture = TestBed.createComponent(SectionSelectorComponent);
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-labelledby')).toBe(
      'section-selector-title'
    );
    expect(
      fixture.nativeElement.querySelector(
        'button[aria-label="Close section selector"]'
      )
    ).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('uses buttons for selectable section types', () => {
    TestBed.configureTestingModule({ imports: [SectionSelectorComponent] });
    const fixture = TestBed.createComponent(SectionSelectorComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('button.section-type-item')
    ).toHaveLength(6);
  });
});
