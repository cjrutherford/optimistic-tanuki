export function resolvePlaywrightHeadless(defaultWhenUnset: boolean) {
  const raw = process.env['PLAYWRIGHT_HEADLESS']?.trim().toLowerCase();

  if (!raw) {
    return defaultWhenUnset;
  }

  if (['1', 'true', 'yes', 'on'].includes(raw)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(raw)) {
    return false;
  }

  return defaultWhenUnset;
}
