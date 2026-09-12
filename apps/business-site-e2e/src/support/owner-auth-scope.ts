export type OwnerAuthScope = 'reusable' | 'credentials';

const REUSABLE_OWNER_EMAIL = 'owner@localbusiness.test';

export function getOwnerAuthScope(email: string): OwnerAuthScope {
  return email === REUSABLE_OWNER_EMAIL ? 'reusable' : 'credentials';
}
