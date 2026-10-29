import declaration from './browser-session-boundary.json';
/** Accepted N06 boundary; this never promises a remote physical-device wipe. */
export const ACCOUNT_DELETION_BROWSER_BOUNDARY = Object.freeze({
  ...declaration,
  applications: Object.freeze([...declaration.applications]),
});
