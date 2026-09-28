const BUSINESS_TIME_ZONE = 'America/New_York';
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;
const ACKNOWLEDGMENT_BUSINESS_HOURS = 1;

const localDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function localParts(date: Date): Record<string, number> {
  return Object.fromEntries(
    localDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
}

function localDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number
): Date {
  const localEpoch = Date.UTC(year, month - 1, day, hour);
  let utcEpoch = localEpoch;

  // Resolve the zone offset from the target's local representation. The
  // operating window never touches the repeated or skipped DST hours.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = localParts(new Date(utcEpoch));
    const representedEpoch = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    utcEpoch = localEpoch - (representedEpoch - utcEpoch);
  }

  return new Date(utcEpoch);
}

function isWeekday(year: number, month: number, day: number): boolean {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

/** Adds one business hour in the HAI lead acknowledgment window. */
export function addBusinessHoursForLeadAcknowledgment(createdAt: Date): Date {
  let remainingMs = ACKNOWLEDGMENT_BUSINESS_HOURS * 60 * 60 * 1000;
  const intakeParts = localParts(createdAt);
  let dayEpoch = Date.UTC(
    intakeParts.year,
    intakeParts.month - 1,
    intakeParts.day
  );

  for (let daysChecked = 0; daysChecked < 14; daysChecked += 1) {
    const day = new Date(dayEpoch);
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const date = day.getUTCDate();

    if (isWeekday(year, month, date)) {
      const opensAt = localDateTimeToUtc(
        year,
        month,
        date,
        BUSINESS_START_HOUR
      );
      const closesAt = localDateTimeToUtc(year, month, date, BUSINESS_END_HOUR);
      const cursor = Math.max(createdAt.getTime(), opensAt.getTime());

      if (cursor < closesAt.getTime()) {
        const availableMs = closesAt.getTime() - cursor;
        if (remainingMs <= availableMs) {
          return new Date(cursor + remainingMs);
        }
        remainingMs -= availableMs;
      }
    }

    dayEpoch += 24 * 60 * 60 * 1000;
  }

  throw new Error('Unable to calculate lead acknowledgment due time');
}
