import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { OwnerFilterBarComponent } from './owner-filter-bar.component';

describe('OwnerFilterBarComponent', () => {
  let fixture: ComponentFixture<OwnerFilterBarComponent>;
  let el: HTMLElement;
  let queries: string[];
  let cleared: jest.Mock;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OwnerFilterBarComponent] });
    fixture = TestBed.createComponent(OwnerFilterBarComponent);
    queries = [];
    cleared = jest.fn();
    fixture.componentInstance.query.subscribe((q) => queries.push(q));
    fixture.componentInstance.cleared.subscribe(cleared);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  function type(value: string) {
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('labels the search input', () => {
    const input = el.querySelector('input') as HTMLInputElement;
    expect(el.querySelector(`label[for="${input.id}"]`)?.textContent).toContain(
      'Search'
    );
  });

  it('emits one trimmed query after the debounce, not per keystroke', fakeAsync(() => {
    type('a');
    tick(100);
    type('al');
    tick(100);
    type(' alice ');
    tick(299);
    expect(queries).toEqual([]);
    tick(1);
    expect(queries).toEqual(['alice']);
  }));

  it('does not re-emit an unchanged query', fakeAsync(() => {
    type('bob');
    tick(300);
    type('bob ');
    tick(300);
    expect(queries).toEqual(['bob']);
  }));

  it('honours a custom debounce', fakeAsync(() => {
    fixture.componentRef.setInput('debounceMs', 50);
    fixture.detectChanges();
    type('x');
    tick(50);
    expect(queries).toEqual(['x']);
  }));

  it('clear empties the box, emits an empty query at once and signals cleared', fakeAsync(() => {
    type('carol');
    tick(300);
    (el.querySelector('.owner-filter-bar__clear') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('');
    expect(queries).toEqual(['carol', '']);
    expect(cleared).toHaveBeenCalledTimes(1);
  }));

  it('clear cancels a pending debounced query', fakeAsync(() => {
    type('dave');
    (el.querySelector('.owner-filter-bar__clear') as HTMLButtonElement).click();
    tick(300);
    expect(queries).toEqual([]);
    expect(cleared).toHaveBeenCalledTimes(1);
  }));
});
