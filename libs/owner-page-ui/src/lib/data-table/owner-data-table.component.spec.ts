import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { OwnerDataTableComponent } from './owner-data-table.component';

interface Row {
  id: string;
  name: string;
}

describe('OwnerDataTableComponent', () => {
  let fixture: ComponentFixture<OwnerDataTableComponent<Row>>;
  let el: HTMLElement;

  function set(inputs: Record<string, unknown>) {
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();
  }

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      imports: [OwnerDataTableComponent],
      providers: [ThemeService],
    });
    fixture = TestBed.createComponent(OwnerDataTableComponent<Row>);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('columns', [{ field: 'name' }]);
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows loading until rows arrive', () => {
    set({ rows: null });
    expect(el.querySelector('ot-owner-state')?.getAttribute('data-kind')).toBe(
      'loading'
    );
    expect(el.querySelector('otui-ag-grid')).toBeNull();
  });

  it('shows loading while loading even with rows', () => {
    set({ rows: [{ id: '1', name: 'A' }], loading: true });
    expect(el.querySelector('ot-owner-state')?.getAttribute('data-kind')).toBe(
      'loading'
    );
  });

  it('shows empty with its message and action', () => {
    set({ rows: [], emptyMessage: 'No users.', emptyActionLabel: 'Invite' });
    const state = el.querySelector('ot-owner-state') as HTMLElement;
    expect(state.getAttribute('data-kind')).toBe('empty');
    expect(state.textContent).toContain('No users.');
    const spy = jest.fn();
    fixture.componentInstance.emptyAction.subscribe(spy);
    (state.querySelector('button') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalled();
  });

  it('shows an error, not empty, when the load failed with no rows', () => {
    set({ rows: [], error: 'Users are unavailable.' });
    const state = el.querySelector('ot-owner-state') as HTMLElement;
    expect(state.getAttribute('data-kind')).toBe('error');
    expect(state.textContent).toContain('Users are unavailable.');
    expect(state.textContent).not.toContain('Nothing here');
  });

  it('error wins over loading and emits retry', () => {
    set({ rows: null, loading: true, error: 'Down.' });
    const state = el.querySelector('ot-owner-state') as HTMLElement;
    expect(state.getAttribute('data-kind')).toBe('error');
    const spy = jest.fn();
    fixture.componentInstance.retry.subscribe(spy);
    (state.querySelector('button') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('renders the grid when there are rows', () => {
    set({ rows: [{ id: '1', name: 'A' }] });
    expect(el.querySelector('ot-owner-state')).toBeNull();
    expect(el.querySelector('otui-ag-grid')).not.toBeNull();
  });

  it('emits rowClick with the row data', () => {
    const spy = jest.fn();
    fixture.componentInstance.rowClick.subscribe(spy);
    const row = { id: '1', name: 'A' };
    fixture.componentInstance.gridOptions.onRowClicked?.({
      data: row,
    } as never);
    expect(spy).toHaveBeenCalledWith(row);
  });
});
