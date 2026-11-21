import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DirectoryListComponent } from './directory-list.component';
import { LocalDirectoryListing } from '../models';

const make = (n: number, start = 0): LocalDirectoryListing[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `Biz ${start + i}`,
    category: 'shop',
    attribution: [],
    notices: [],
    reference: `r${start + i}`,
  }));

describe('DirectoryListComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([])] })
  );

  it('announces the count politely and reflects busy state', () => {
    const fixture = TestBed.createComponent(DirectoryListComponent);
    fixture.componentRef.setInput('listings', make(2));
    fixture.componentRef.setInput('hasMore', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const live = el.querySelector(
      '[data-testid="result-announcement"]'
    ) as HTMLElement;
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent?.trim()).toBe('2 businesses shown, more available');
    expect(el.querySelector('ul')?.getAttribute('aria-busy')).toBe('false');

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(live.textContent?.trim()).toBe('Loading businesses');
    expect(el.querySelector('ul')?.getAttribute('aria-busy')).toBe('true');
  });

  it('labels the region by its heading', () => {
    const fixture = TestBed.createComponent(DirectoryListComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe(
      el.querySelector('h2')?.id
    );
  });

  it('emits loadMore and moves focus to the first newly loaded item', () => {
    const fixture = TestBed.createComponent(DirectoryListComponent);
    fixture.componentRef.setInput('listings', make(2));
    fixture.componentRef.setInput('hasMore', true);
    fixture.detectChanges();
    const emitted = jest.fn();
    fixture.componentInstance.loadMore.subscribe(emitted);
    const el = fixture.nativeElement as HTMLElement;
    (
      el.querySelector('[data-testid="load-more"]') as HTMLButtonElement
    ).click();
    expect(emitted).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('listings', make(4));
    fixture.detectChanges();
    const items = el.querySelectorAll('li');
    expect(items).toHaveLength(4);
    expect(document.activeElement).toBe(items[2]);
  });

  it('hides Show more when there is nothing more', () => {
    const fixture = TestBed.createComponent(DirectoryListComponent);
    fixture.componentRef.setInput('listings', make(1));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="load-more"]')
    ).toBeNull();
  });
});
