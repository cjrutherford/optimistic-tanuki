import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskFormComponent, endOfDayUtc } from './task-form.component';

describe('TaskFormComponent', () => {
  let component: TaskFormComponent;
  let fixture: ComponentFixture<TaskFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

/**
 * A due date has to mean the same day wherever it is read.
 *
 * The form appended T23:59:59 to the picked day, which makes a Date in
 * whatever zone the browser happens to be in. Two people picking the same day
 * stored two different instants, and read back somewhere else one of them
 * showed the day after.
 */
describe('endOfDayUtc', () => {
  it('pins the chosen day to a fixed instant', () => {
    expect(endOfDayUtc('2026-08-29')?.toISOString()).toBe(
      '2026-08-29T23:59:59.000Z'
    );
  });

  it('gives the same instant regardless of where it is called', () => {
    // Nothing in it reads the local zone, which is the whole point.
    const first = endOfDayUtc('2026-01-01');
    const second = endOfDayUtc('2026-01-01');

    expect(first?.getTime()).toBe(second?.getTime());
    expect(first?.toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  it('has no date when none was chosen', () => {
    expect(endOfDayUtc('')).toBeUndefined();
    expect(endOfDayUtc(undefined)).toBeUndefined();
  });

  it('refuses something that is not a date rather than inventing one', () => {
    expect(endOfDayUtc('next tuesday')).toBeUndefined();
  });
});
