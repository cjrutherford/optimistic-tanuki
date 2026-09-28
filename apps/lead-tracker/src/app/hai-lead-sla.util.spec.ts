import { addBusinessHoursForLeadAcknowledgment } from './hai-lead-sla.util';

describe('addBusinessHoursForLeadAcknowledgment', () => {
  it('pauses the one-hour clock overnight and across weekends', () => {
    const createdAt = new Date('2026-09-25T20:30:00.000Z'); // Friday 4:30 PM EDT

    expect(addBusinessHoursForLeadAcknowledgment(createdAt)).toEqual(
      new Date('2026-09-28T13:30:00.000Z') // Monday 9:30 AM EDT
    );
  });

  it('uses the America/New_York work window on both sides of DST', () => {
    const beforeSpringForward = new Date('2026-03-06T21:30:00.000Z'); // Friday 4:30 PM EST

    expect(addBusinessHoursForLeadAcknowledgment(beforeSpringForward)).toEqual(
      new Date('2026-03-09T13:30:00.000Z') // Monday 9:30 AM EDT
    );
  });

  it('starts an after-hours intake at the next weekday opening', () => {
    const afterHours = new Date('2026-09-26T00:00:00.000Z'); // Friday 8 PM EDT

    expect(addBusinessHoursForLeadAcknowledgment(afterHours)).toEqual(
      new Date('2026-09-28T14:00:00.000Z') // Monday 10 AM EDT
    );
  });
});
