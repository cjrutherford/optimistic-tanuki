import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ageFromDateOfBirth } from './age';
import {
  DateOfBirthStepComponent,
  DateOfBirthStepResult,
} from './date-of-birth-step.component';

describe('ageFromDateOfBirth', () => {
  const now = new Date('2026-06-15T00:00:00Z');
  it('counts whole years and rejects invalid dates', () => {
    expect(ageFromDateOfBirth('2000-06-15', now)).toBe(26);
    expect(ageFromDateOfBirth('2000-06-16', now)).toBe(25);
    expect(ageFromDateOfBirth('2000-02-31', now)).toBeNull();
    expect(ageFromDateOfBirth('', now)).toBeNull();
  });
});

describe('DateOfBirthStepComponent', () => {
  let component: DateOfBirthStepComponent;
  let fixture: ComponentFixture<DateOfBirthStepComponent>;
  let emitted: DateOfBirthStepResult[];

  beforeEach(() => {
    fixture = TestBed.createComponent(DateOfBirthStepComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.submitted.subscribe((r) => emitted.push(r));
  });

  it('emits the date for an adult', () => {
    component.dateOfBirth = '1990-01-01';
    component.submit();
    expect(emitted).toEqual([{ dateOfBirth: '1990-01-01' }]);
  });

  it('requires a guardian email for a teen', () => {
    const year = new Date().getUTCFullYear() - 15;
    component.dateOfBirth = `${year}-01-01`;
    component.submit();
    expect(emitted).toEqual([]);
    component.guardianEmail = 'parent@example.com';
    component.submit();
    expect(emitted[0].guardianEmail).toBe('parent@example.com');
  });

  it('blocks under 13', () => {
    const year = new Date().getUTCFullYear() - 10;
    component.dateOfBirth = `${year}-01-01`;
    component.submit();
    expect(emitted).toEqual([]);
  });
});
