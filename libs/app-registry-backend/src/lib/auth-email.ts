export const AUTH_EMAIL_ROOT_DOMAINS = new Set([
  'christopherrutherford.net',
  'optimistic-tanuki.com',
  'forgeofwill.com',
  'hopefulaspirationsindustries.com',
  'towne-square.com',
]);

export function isApprovedAuthEmailSender(address: string): boolean {
  const parts = address.trim().toLowerCase().split('@');
  return (
    parts.length === 2 &&
    Boolean(parts[0]) &&
    AUTH_EMAIL_ROOT_DOMAINS.has(parts[1])
  );
}
