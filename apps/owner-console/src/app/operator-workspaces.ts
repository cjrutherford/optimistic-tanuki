export interface WorkspaceActionCard {
  title: string;
  description: string;
  route: string;
  highlight?: string;
}

export interface OperatorWorkspaceConfig {
  path: string;
  label: string;
  description: string;
  summary: string;
  checklist: string[];
  cards: WorkspaceActionCard[];
}

export const OPERATOR_WORKSPACES: OperatorWorkspaceConfig[] = [
  {
    path: 'governance',
    label: 'Governance',
    description:
      'Identity, permissions, role assignment, and cross-platform access controls.',
    summary:
      'Manage the people, scopes, and policies that define platform authority.',
    checklist: [
      'Review user and profile coverage across platform scopes.',
      'Maintain roles, permissions, and app scopes.',
      'Inspect high-risk access changes before they reach production workflows.',
    ],
    cards: [
      {
        title: 'Users',
        description: 'Review operator and user profiles across all app scopes.',
        route: '/dashboard/users',
        highlight: 'Profile governance',
      },
      {
        title: 'Roles',
        description:
          'Maintain reusable role bundles for platform and app operators.',
        route: '/dashboard/roles',
        highlight: 'Role catalog',
      },
      {
        title: 'Permissions',
        description:
          'Manage low-level capability grants and verify enforcement shape.',
        route: '/dashboard/permissions',
        highlight: 'Capability model',
      },
      {
        title: 'App Scopes',
        description:
          'Control which applications and surfaces participate in platform RBAC.',
        route: '/dashboard/app-scopes',
        highlight: 'Scope boundaries',
      },
      {
        title: 'Permissions Inspector',
        description:
          'Trace effective permissions and route coverage for a profile or scope.',
        route: '/dashboard/permissions-inspector',
        highlight: 'Effective access',
      },
    ],
  },
  {
    path: 'experience',
    label: 'Experience',
    description:
      'Tenant-facing experience controls for configurable apps, themes, and publish state.',
    summary:
      'Shape how user-facing applications are configured, themed, and shipped.',
    checklist: [
      'Publish and review app configurations before routing users to them.',
      'Keep themes aligned to brand and application intent.',
      'Track draft versus active experience changes.',
    ],
    cards: [
      {
        title: 'App Configurations',
        description:
          'Review the set of configurable applications and their published states.',
        route: '/dashboard/app-config',
        highlight: 'Published experiences',
      },
      {
        title: 'Design New Configuration',
        description:
          'Launch the application configuration designer for a new or existing experience.',
        route: '/dashboard/app-config/designer',
        highlight: 'Release design',
      },
      {
        title: 'Theme Management',
        description:
          'Apply theme-level controls that shape brand expression across clients.',
        route: '/dashboard/theme',
        highlight: 'Brand control',
      },
      {
        title: 'Application Registry',
        description:
          'Maintain cross-app destinations, navigation links, and change history.',
        route: '/dashboard/registry',
        highlight: 'Registry control',
      },
    ],
  },
  {
    path: 'commerce',
    label: 'Commerce',
    description:
      'Catalog, order, booking, and revenue operations across store-facing products.',
    summary:
      'Oversee products, orders, bookings, and service capacity from one workspace.',
    checklist: [
      'Monitor order backlog and fulfillment exceptions.',
      'Review the booking pipeline and resource availability.',
      'Keep catalog status aligned with operator intent.',
    ],
    cards: [
      {
        title: 'Store Overview',
        description: 'Open the current commerce dashboard and revenue summary.',
        route: '/dashboard/store/overview',
        highlight: 'Revenue posture',
      },
      {
        title: 'Products',
        description: 'Maintain product status, pricing, and stock exposure.',
        route: '/dashboard/store/products',
        highlight: 'Catalog control',
      },
      {
        title: 'Orders',
        description: 'Investigate outstanding orders and manual interventions.',
        route: '/dashboard/store/orders',
        highlight: 'Fulfillment queue',
      },
      {
        title: 'Appointments',
        description:
          'Handle booking approval flow and service-related appointment issues.',
        route: '/dashboard/store/appointments',
        highlight: 'Service operations',
      },
      {
        title: 'Availability',
        description:
          'Adjust booking capacity and operator-controlled openings.',
        route: '/dashboard/store/availability',
        highlight: 'Capacity planning',
      },
    ],
  },
  {
    path: 'community-ops',
    label: 'Community Ops',
    description:
      'Communities, cities, membership surfaces, and local-marketplace oversight.',
    summary:
      'Coordinate local surfaces, oversee community health, and intervene when needed.',
    checklist: [
      'Curate cities and community lifecycle status.',
      'Resolve membership issues and operator escalations.',
      'Track localized activity surfaces that affect marketplace trust.',
    ],
    cards: [
      {
        title: 'Communities',
        description:
          'Manage active communities and inspect their moderation surface.',
        route: '/dashboard/communities',
        highlight: 'Community lifecycle',
      },
      {
        title: 'Cities',
        description:
          'Control city-level locality records and rollout readiness.',
        route: '/dashboard/cities',
        highlight: 'Locality coverage',
      },
    ],
  },
];
