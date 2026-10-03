/**
 * Who may do what, as data.
 *
 * The permissions service stores scopes, permissions and roles as rows; this
 * module is the declaration of the ones this product needs, kept separate
 * from the vendored service so it moves upstream unchanged. Nothing here
 * imports vendored code: a seeder maps these records onto the service's DTOs,
 * and at integration only that mapping changes.
 */

/** Towne Square's app scope, already declared by the permissions seed. */
export const APP_SCOPE = 'local-hub';

/**
 * Roles that carry civic permissions. Membership and administration are
 * local-hub's existing roles: every member may contribute and corroborate,
 * and admins operate the briefing service. Verified officials are new.
 */
export const ROLES = [
  'local_hub_member',
  'local_hub_verified_official',
  'local_hub_admin',
] as const;
export type RoleName = (typeof ROLES)[number];

/** Roles the permissions seed already declares; civic only adds grants. */
export const EXISTING_ROLES: readonly RoleName[] = [
  'local_hub_member',
  'local_hub_admin',
];

export interface PermissionRecord {
  /** `resource.action`, unique within the scope. */
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
    name: 'briefing.read',
    resource: 'briefing',
    action: 'read',
    description: 'Read published briefings and stories.',
  },
  {
    name: 'contribution.create',
    resource: 'contribution',
    action: 'create',
    description: 'Submit an artifact or an eyewitness account.',
  },
  {
    name: 'contribution.read',
    resource: 'contribution',
    action: 'read',
    description: 'Read contributions and their corroboration state.',
  },
  {
    name: 'contribution.withdraw',
    resource: 'contribution',
    action: 'withdraw',
    description: "Withdraw one's own contribution.",
  },
  {
    name: 'corroboration.create',
    resource: 'corroboration',
    action: 'create',
    description: "Corroborate another contributor's report.",
  },
  {
    name: 'artifact.upload',
    resource: 'artifact',
    action: 'upload',
    description: 'Attach a document, recording, or photograph.',
  },
  {
    name: 'official-record.submit',
    resource: 'official-record',
    action: 'submit',
    description:
      'Submit a record as a verified officeholder; grounds briefing claims.',
  },
  {
    name: 'contributor-profile.update',
    resource: 'contributor-profile',
    action: 'update',
    description: "Edit one's own handle, display mode, and disclosures.",
  },
  {
    name: 'review-decision.read',
    resource: 'review-decision',
    action: 'read',
    description: 'Read automated review decisions and their recorded reasons.',
  },
  {
    name: 'account.suspend',
    resource: 'account',
    action: 'suspend',
    description: 'Suspend an account for abuse.',
  },
  {
    name: 'town.configure',
    resource: 'town',
    action: 'configure',
    description: 'Add or change a town and its sources.',
  },
  {
    name: 'official.verify',
    resource: 'official',
    action: 'verify',
    description: "Confirm an official's application after the callback.",
  },
  {
    name: 'takedown.manage',
    resource: 'takedown',
    action: 'manage',
    description: 'Review copyright takedown notices and act on them.',
  },
  {
    name: 'community.maintain',
    resource: 'community',
    action: 'maintain',
    description:
      'Run community upkeep: re-review held contributions, sweep outcomes, export promotions.',
  },
  {
    name: 'density.read',
    resource: 'density',
    action: 'read',
    description: 'Read per-town contributor density and coverage.',
  },
];

/** Each role's civic grants, declared explicitly so a grant is never implied. */
export const ROLE_PERMISSIONS: Readonly<Record<RoleName, readonly string[]>> = {
  local_hub_member: [
    'briefing.read',
    'contribution.read',
    'contribution.create',
    'contribution.withdraw',
    'corroboration.create',
    'artifact.upload',
    'contributor-profile.update',
  ],
  local_hub_verified_official: [
    'briefing.read',
    'contribution.read',
    'official-record.submit',
    'artifact.upload',
    'contributor-profile.update',
  ],
  local_hub_admin: [
    'briefing.read',
    'contribution.read',
    'review-decision.read',
    'account.suspend',
    'town.configure',
    'density.read',
    'official.verify',
    'takedown.manage',
    'community.maintain',
  ],
};

/**
 * Permissions a role takes away even when another role grants them. Role
 * grants are additive and a verified official is also a member, but an
 * official corroborating a meeting they ran is not an independent witness.
 * civic-contributions enforces this; the permissions service cannot.
 */
export const ROLE_DENIALS: Readonly<
  Partial<Record<RoleName, readonly string[]>>
> = {
  local_hub_verified_official: ['corroboration.create'],
};

/** What an account holding these roles may do: every grant, less every denial. */
export function effectivePermissions(roles: readonly RoleName[]): Set<string> {
  const granted = new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]));
  for (const role of roles) {
    for (const denied of ROLE_DENIALS[role] ?? []) granted.delete(denied);
  }
  return granted;
}

export interface ScopeSeed {
  appScope: { name: string; description: string; active: boolean };
  permissions: readonly PermissionRecord[];
  roles: readonly {
    name: RoleName;
    /** Already declared by the permissions seed; only its grants are added. */
    existing: boolean;
    description: string;
    permissions: readonly string[];
  }[];
}

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  local_hub_member:
    'Standard member of a local-hub community; reads briefings, submits and corroborates reports.',
  local_hub_verified_official:
    'Submits official records; verified by domain and roster, then a callback.',
  local_hub_admin:
    'Community admin for local-hub; also reads review decisions, configures towns and suspends abusive accounts.',
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
      existing: EXISTING_ROLES.includes(name),
      description: ROLE_DESCRIPTIONS[name],
      permissions: ROLE_PERMISSIONS[name],
    })),
  };
}
