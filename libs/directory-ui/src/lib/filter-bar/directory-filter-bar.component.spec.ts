import { TestBed } from '@angular/core/testing';
import { DirectoryFilterBarComponent } from './directory-filter-bar.component';

describe('DirectoryFilterBarComponent', () => {
  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(DirectoryFilterBarComponent);
    for (const [k, v] of Object.entries(inputs))
      fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture;
  }

  it('labels every control and the search landmark', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('form')?.getAttribute('role')).toBe('search');
    expect(el.querySelector('form')?.getAttribute('aria-label')).toBe(
      'Search the business directory'
    );
    for (const id of ['otd-q', 'otd-category', 'otd-adult']) {
      expect(el.querySelector(`label[for="${id}"]`)).not.toBeNull();
      expect(el.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('restores values and keeps a deep-linked category selectable', () => {
    const fixture = render({
      value: { q: 'pizza', category: 'restaurant', adult: true },
      categories: ['shop'],
    });
    const el = fixture.nativeElement as HTMLElement;
    expect((el.querySelector('#otd-q') as HTMLInputElement).value).toBe(
      'pizza'
    );
    expect((el.querySelector('#otd-category') as HTMLSelectElement).value).toBe(
      'restaurant'
    );
    expect((el.querySelector('#otd-adult') as HTMLInputElement).checked).toBe(
      true
    );
    const options = Array.from(el.querySelectorAll('option')).map((o) =>
      o.textContent?.trim()
    );
    expect(options).toEqual(['All categories', 'Restaurant', 'Shop']);
  });

  it('emits trimmed filters on submit and announces them', () => {
    const fixture = render({ categories: ['shop'] });
    const el = fixture.nativeElement as HTMLElement;
    const emitted = jest.fn();
    fixture.componentInstance.filtersSubmit.subscribe(emitted);
    (el.querySelector('#otd-q') as HTMLInputElement).value = '  tacos ';
    (el.querySelector('#otd-category') as HTMLSelectElement).value = 'shop';
    el.querySelector('form')?.dispatchEvent(
      new Event('submit', { cancelable: true })
    );
    fixture.detectChanges();
    expect(emitted).toHaveBeenCalledWith({
      q: 'tacos',
      category: 'shop',
      adult: false,
    });
    expect(
      el.querySelector('[data-testid="filter-announcement"]')?.textContent
    ).toContain('Searching businesses: “tacos”, Shop');
    expect(
      el
        .querySelector('[data-testid="filter-announcement"]')
        ?.getAttribute('aria-live')
    ).toBe('polite');
  });

  it('clears filters', () => {
    const fixture = render({ value: { q: 'x', category: '', adult: false } });
    const emitted = jest.fn();
    fixture.componentInstance.filtersSubmit.subscribe(emitted);
    (
      fixture.nativeElement.querySelector(
        '[data-testid="filters-clear"]'
      ) as HTMLButtonElement
    ).click();
    expect(emitted).toHaveBeenCalledWith({ q: '', category: '', adult: false });
  });
});
