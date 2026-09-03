import { elapsedBetween } from './task-time-entry.service';

/**
 * The duration of a time entry, decided by the server from the two ends of it.
 *
 * It used to be whatever the caller sent. A three minute entry was made to
 * claim forty hours through the ordinary update route, and then minus five
 * hundred seconds, and both were stored. Meanwhile the app itself sent no
 * figure at all, so every finished entry recorded zero.
 */
describe('elapsedBetween', () => {
  it('counts the seconds between the ends', () => {
    expect(
      elapsedBetween(
        new Date('2026-08-28T10:00:00Z'),
        new Date('2026-08-28T10:03:37Z')
      )
    ).toBe(217);
  });

  it('never returns a negative duration', () => {
    // A clock that went backwards, or an end typed before the start. Recording
    // nothing beats a figure that quietly subtracts from somebody's total.
    expect(
      elapsedBetween(
        new Date('2026-08-28T10:05:00Z'),
        new Date('2026-08-28T10:00:00Z')
      )
    ).toBe(0);
  });

  it('copes with dates that arrive as strings from the driver', () => {
    expect(
      elapsedBetween(
        '2026-08-28T10:00:00Z' as unknown as Date,
        '2026-08-28T10:01:00Z' as unknown as Date
      )
    ).toBe(60);
  });
});
