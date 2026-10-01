/**
 * Who may do what, as data.
 *
 * The permissions service stores scopes, permissions and roles as rows; this
 * module is the declaration of the ones this product needs, kept separate
 * from the vendored service so it moves upstream unchanged. Nothing here
 * imports vendored code: a seeder maps these records onto the service's DTOs,
 * and at integration only that mapping changes.
 */

/**
 * The destination's app scope. Upstream names the application `local-hub` and
 * markets it as Towne Square; `ALL_APP_SCOPES` upstream lists `local-hub`, so
 * that is the name role assignments must carry to migrate untouched.
 */
export const APP_SCOPE = 'local-hub';

/**
 * Names this scope has had here. The seeder renames rather than creating a
 * second scope, so assignments made under an earlier name survive.
 */
export const PREVIOUS_APP_SCOPE_NAMES = ['towne-square'] as const;

export const ROLES = [
  'reader',
  'contributor',
  'verified-official',
  'operator',
] as const;
export type RoleName = (typeof ROLES)[number];

export interface PermissionRecord {
  /** `resource:action`, unique within the scope. */
  name: string;
  resource: string;
  action: string;
  description: string;
}

/**
 * Permissions follow the community corroboration plan: contributors submit
 * and corroborate, officials submit records that ground claims, operators see
 * why the automated review decided what it did. No role grants moderation of
 * another person's contribution, because review is mechanical.
 */
export const PERMISSIONS: readonly PermissionRecord[] = [
  {
    name: 'briefing:read',
    resource: 'briefing',
    action: 'read',
    description: 'Read published briefings and stories.',
  },
  {
    name: 'contribution:create',
    resource: 'contribution',
    action: 'create',
    description: 'Submit an artifact or an eyewitness account.',
  },
  {
    name: 'contribution:read',
    resource: 'contribution',
    action: 'read',
    description: 'Read contributions and their corroboration state.',
  },
  {
    name: 'contribution:withdraw',
    resource: 'contribution',
    action: 'withdraw',
    description: "Withdraw one's own contribution.",
  },
  {
    name: 'corroboration:create',
    resource: 'corroboration',
    action: 'create',
    description: "Corroborate another contributor's report.",
  },
  {
    name: 'artifact:upload',
    resource: 'artifact',
    action: 'upload',
    description: 'Attach a document, recording, or photograph.',
  },
  {
    name: 'official-record:submit',
    resource: 'official-record',
    action: 'submit',
    description:
      'Submit a record as a verified officeholder; grounds briefing claims.',
  },
  {
    name: 'contributor-profile:update',
    resource: 'contributor-profile',
    action: 'update',
    description: "Edit one's own handle, display mode, and disclosures.",
  },
  {
    name: 'review-decision:read',
    resource: 'review-decision',
    action: 'read',
    description: 'Read automated review decisions and their recorded reasons.',
  },
  {
    name: 'account:suspend',
    resource: 'account',
    action: 'suspend',
    description: 'Suspend an account for abuse.',
  },
  {
    name: 'town:configure',
    resource: 'town',
    action: 'configure',
    description: 'Add or change a town and its sources.',
  },
  {
    name: 'density:read',
    resource: 'density',
    action: 'read',
    description: 'Read per-town contributor density and coverage.',
  },
];

/** Roles are cumulative in practice but declared explicitly, so a grant is never implied. */
export const ROLE_PERMISSIONS: Readonly<Record<RoleName, readonly string[]>> = {
  reader: ['briefing:read', 'contribution:read'],
  contributor: [
    'briefing:read',
    'contribution:read',
    'contribution:create',
    'contribution:withdraw',
    'corroboration:create',
    'artifact:upload',
    'contributor-profile:update',
  ],
  'verified-official': [
    'briefing:read',
    'contribution:read',
    'official-record:submit',
    'artifact:upload',
    'contributor-profile:update',
  ],
  operator: [
    'briefing:read',
    'contribution:read',
    'review-decision:read',
    'account:suspend',
    'town:configure',
    'density:read',
  ],
};

export interface ScopeSeed {
  appScope: { name: string; description: string; active: boolean };
  permissions: readonly PermissionRecord[];
  roles: readonly {
    name: RoleName;
    description: string;
    permissions: readonly string[];
  }[];
}

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  reader: 'Reads briefings. The default for a new account.',
  contributor: 'Submits and corroborates reports about a town.',
  'verified-official':
    'Submits official records; verified by domain and roster, then a callback.',
  operator:
    'Runs the service; reads review decisions and suspends abusive accounts.',
};

/** The scope, its permissions, and its roles, ready for a seeder to apply. */
export function scopeSeed(): ScopeSeed {
  return {
    appScope: {
      name: APP_SCOPE,
      description: 'Civic briefings and community corroboration.',
      active: true,
    },
    permissions: PERMISSIONS,
    roles: ROLES.map((name) => ({
      name,
      description: ROLE_DESCRIPTIONS[name],
      permissions: ROLE_PERMISSIONS[name],
    })),
  };
}
