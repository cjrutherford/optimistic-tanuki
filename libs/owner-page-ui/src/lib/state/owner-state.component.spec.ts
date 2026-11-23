import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OwnerStateComponent } from './owner-state.component';

describe('OwnerStateComponent', () => {
  let fixture: ComponentFixture<OwnerStateComponent>;

  function render(inputs: Record<string, unknown>): HTMLElement {
    fixture = TestBed.createComponent(OwnerStateComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [OwnerStateComponent] })
  );

  it('loading is a busy status with no actions', () => {
    const el = render({ kind: 'loading' });
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.textContent).toContain('Loading');
    expect(el.querySelector('button')).toBeNull();
  });

  it('empty shows its message and no button unless an action is given', () => {
    const el = render({ kind: 'empty', message: 'No users match.' });
    expect(el.getAttribute('role')).toBe('status');
    expect(el.textContent).toContain('No users match.');
    expect(el.querySelector('button')).toBeNull();
  });

  it('empty emits action from its call to action', () => {
    const el = render({ kind: 'empty', actionLabel: 'Invite a user' });
    const spy = jest.fn();
    fixture.componentInstance.action.subscribe(spy);
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Invite a user');
    button.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('error is an alert with its own heading and a Retry that emits', () => {
    const el = render({ kind: 'error', message: 'Users could not be loaded.' });
    const spy = jest.fn();
    fixture.componentInstance.retry.subscribe(spy);
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('data-kind')).toBe('error');
    expect(el.textContent).toContain('Unavailable');
    expect(el.textContent).toContain('Users could not be loaded.');
    (el.querySelector('button') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('error never reads as empty', () => {
    const error = render({ kind: 'error' });
    expect(error.textContent).not.toContain('Nothing here');
    const empty = render({ kind: 'empty' });
    expect(empty.textContent).not.toContain('Unavailable');
    expect(empty.querySelector('button')).toBeNull();
  });
});
