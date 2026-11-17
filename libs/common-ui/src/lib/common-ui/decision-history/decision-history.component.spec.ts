import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  DecisionHistoryComponent,
  DecisionHistoryEntry,
  DecisionUndoRequest,
} from './decision-history.component';

const entry = (
  over: Partial<DecisionHistoryEntry> = {}
): DecisionHistoryEntry => ({
  id: 'd1',
  label: 'Merge',
  actor: 'reviewer-1',
  at: '2026-11-17T00:00:00Z',
  reason: 'same shop',
  reversible: true,
  ...over,
});

describe('DecisionHistoryComponent', () => {
  let fixture: ComponentFixture<DecisionHistoryComponent>;
  let component: DecisionHistoryComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const buttons = () =>
    Array.from(el().querySelectorAll('otui-button')) as HTMLElement[];
  const byText = (text: string) =>
    buttons().find((b) => b.textContent?.trim() === text);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecisionHistoryComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DecisionHistoryComponent);
    component = fixture.componentInstance;
  });

  it('lists entries and offers Undo only on a reversible, un-undone entry', () => {
    component.entries = [
      entry({ id: 'a', label: 'Confirm', reversible: false, undone: true }),
      entry({ id: 'b' }),
    ];
    fixture.detectChanges();
    expect(el().textContent).toContain('Confirm');
    expect(el().textContent).toContain('Undone');
    expect(
      buttons().filter((b) => b.textContent?.trim() === 'Undo')
    ).toHaveLength(1);
  });

  it('says so when nothing has been decided', () => {
    fixture.detectChanges();
    expect(el().textContent).toContain('No decisions recorded.');
    expect(byText('Undo')).toBeUndefined();
  });

  it('requires a reason before emitting the undo', () => {
    component.entries = [entry()];
    const emitted: DecisionUndoRequest[] = [];
    component.undoConfirmed.subscribe((r) => emitted.push(r));
    fixture.detectChanges();
    component.start(component.entries[0]);
    fixture.detectChanges();
    expect(el().querySelector('[role="alertdialog"]')).not.toBeNull();
    component.confirm();
    fixture.detectChanges();
    expect(emitted).toHaveLength(0);
    expect(el().textContent).toContain('Enter a reason');
    component.reason = '  wrong shop ';
    component.confirm();
    fixture.detectChanges();
    expect(emitted).toEqual([
      { entry: component.entries[0], reason: 'wrong shop' },
    ]);
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('cancel closes the confirmation without emitting', () => {
    component.entries = [entry()];
    const emitted: DecisionUndoRequest[] = [];
    component.undoConfirmed.subscribe((r) => emitted.push(r));
    component.start(component.entries[0]);
    component.cancel();
    fixture.detectChanges();
    expect(emitted).toHaveLength(0);
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
  });
});
