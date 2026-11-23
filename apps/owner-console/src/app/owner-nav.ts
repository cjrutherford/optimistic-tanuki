/**
 * The single navigation model for the owner console. The sidebar, the
 * breadcrumbs and the command palette are all generated from `OWNER_NAV`, and
 * `owner-nav.spec.ts` fails when a routed page is missing from the tree or a
 * nav entry points at a route that does not exist.
 */
export interface OwnerNavLeaf {
  /** Plain label shown in the sidebar, breadcrumbs and palette. */
  label: string;
  /** Absolute route. `:param` segments mark a page that needs a record. */
  path: string;
  /** Short glyph shown beside the label; decorative only. */
  icon: string;
  /** Permission the owner needs to see and open the page. */
  requiredPermission?: string;
  /**
   * Page only makes sense inside a town. Its path holds `:townId`, filled from
   * the selected town; with no town selected the nav shows it disabled.
   */
  needsTown?: boolean;
  /**
   * Key of the attention source (`GET /api/owner/attention`) whose count this
   * page works through. The sidebar shows it as a badge.
   */
  countSource?: string;
  /** Extra words the command palette matches on. */
  keywords?: string[];
}

export interface OwnerNavGroup {
  id: string;
  label: string;
  icon: string;
  leaves: OwnerNavLeaf[];
}

export interface OwnerNavEntry {
  group: OwnerNavGroup;
  leaf: OwnerNavLeaf;
  /** Real route once resolved against the town context (see resolveNavEntries). */
  href?: string;
  /** Set when the page needs a town and none is selected. */
  hint?: string;
}

export interface OwnerBreadcrumb {
  label: string;
  /** Absent on the last crumb and on a group crumb with no landing page. */
  path?: string;
}

export const HOME_PATH = '/dashboard/home';
export const TOWNS_PATH = '/dashboard/towns';

/** Hint shown beside a town page while no town is selected. */
export const PICK_A_TOWN = 'Pick a town';

export const OWNER_NAV: readonly OwnerNavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    icon: '⌂',
    leaves: [
      {
        label: 'Home',
        path: HOME_PATH,
        icon: '⌂',
        keywords: ['overview', 'dashboard', 'attention', 'inbox', 'health'],
      },
    ],
  },
  {
    id: 'people',
    label: 'People & access',
    icon: '☺',
    leaves: [
      {
        label: 'Users',
        path: '/dashboard/users',
        icon: '☺',
        keywords: ['profiles', 'accounts', 'operators'],
      },
      {
        label: 'Roles',
        path: '/dashboard/roles',
        icon: '◈',
        keywords: ['role bundles', 'rbac'],
      },
      {
        label: 'Permissions',
        path: '/dashboard/permissions',
        icon: '✓',
        keywords: ['capabilities', 'grants', 'rbac'],
      },
      {
        label: 'App access',
        path: '/dashboard/app-scopes',
        icon: '▣',
        keywords: ['app scopes', 'scopes'],
      },
      {
        label: 'Access checker',
        path: '/dashboard/permissions-inspector',
        icon: '⌕',
        keywords: ['permissions inspector', 'effective access', 'trace'],
      },
    ],
  },
  {
    id: 'towns',
    label: 'Towns',
    icon: '⌂',
    leaves: [
      {
        label: 'All towns',
        path: TOWNS_PATH,
        icon: '⌂',
        keywords: ['town picker', 'switch town', 'community ops', 'daylight'],
      },
      {
        label: 'Town overview',
        path: '/dashboard/towns/:townId/overview',
        icon: '⌂',
        needsTown: true,
        keywords: ['town', 'journal', 'notes', 'cases', 'escalations'],
      },
      {
        label: 'Town communities',
        path: '/dashboard/towns/:townId/communities',
        icon: '☷',
        needsTown: true,
        keywords: ['community ops', 'members', 'managers'],
      },
      {
        label: 'Communities',
        path: '/dashboard/communities',
        icon: '☷',
        keywords: ['groups', 'members'],
      },
      {
        label: 'Cities',
        path: '/dashboard/cities',
        icon: '▦',
        keywords: ['towns', 'localities'],
      },
      {
        label: 'Daylight',
        path: '/dashboard/towns/:townId/daylight',
        icon: '☀',
        needsTown: true,
        keywords: [
          'daylight feed',
          'briefing',
          'pipeline',
          'sources',
          'officials',
          'density',
        ],
      },
      {
        label: 'Boundary review',
        path: '/dashboard/towns/:townId/boundary-review',
        icon: '◌',
        needsTown: true,
        keywords: ['boundaries', 'geometry'],
      },
      {
        label: 'Address review',
        path: '/dashboard/towns/:townId/directory-address-review',
        countSource: 'directory.address',
        icon: '⚑',
        needsTown: true,
        keywords: ['listings', 'addresses', 'local evaluation'],
      },
      {
        label: 'Identity review',
        path: '/dashboard/towns/:townId/directory-identity-review',
        countSource: 'directory.identity',
        icon: '⚑',
        needsTown: true,
        keywords: ['listings', 'identity'],
      },
      {
        label: 'Link review',
        path: '/dashboard/towns/:townId/directory-link-review',
        countSource: 'directory.links',
        icon: '⚑',
        needsTown: true,
        keywords: ['listings', 'links', 'urls'],
      },
      {
        label: 'Duplicate review',
        path: '/dashboard/towns/:townId/directory-duplicates',
        countSource: 'directory.duplicates',
        icon: '⚑',
        needsTown: true,
        keywords: ['listings', 'duplicates', 'merge'],
      },
      {
        label: 'Listing reports',
        path: '/dashboard/towns/:townId/directory-listing-reports',
        countSource: 'directory.reports',
        icon: '⚑',
        needsTown: true,
        keywords: ['listings', 'reports', 'complaints'],
      },
      {
        label: 'Listing suppressions',
        path: '/dashboard/towns/:townId/directory-listing-suppressions',
        countSource: 'directory.suppressions',
        icon: '⚑',
        needsTown: true,
        keywords: ['listings', 'suppressions', 'hidden'],
      },
    ],
  },
  {
    id: 'directory',
    label: 'Directory',
    icon: '☰',
    leaves: [
      {
        label: 'Acquisition runs',
        path: '/dashboard/directory-runs',
        countSource: 'directory.runs.failed',
        icon: '↻',
        keywords: ['import', 'ingest', 'crawl'],
      },
      {
        label: 'Taxonomy cases',
        path: '/dashboard/directory-taxonomy',
        icon: '☰',
        keywords: ['categories', 'classification'],
      },
      {
        label: 'Taxonomy runs',
        path: '/dashboard/directory-taxonomy-runs',
        countSource: 'directory.taxonomy.failed',
        icon: '↻',
        keywords: ['categories', 'classification', 'mappings'],
      },
      {
        label: 'Rights',
        path: '/dashboard/directory-rights',
        icon: '§',
        keywords: ['licensing', 'sources', 'terms'],
      },
      {
        label: 'Withdrawals',
        path: '/dashboard/directory-withdrawals',
        icon: '⤺',
        keywords: ['takedown', 'removal', 'opt out'],
      },
      {
        label: 'Exports',
        path: '/dashboard/directory-exports',
        icon: '⇩',
        keywords: ['download', 'csv'],
      },
      {
        label: 'Controls & metrics',
        path: '/dashboard/directory-operations',
        icon: '◔',
        keywords: ['operations', 'controls', 'metrics', 'stats'],
      },
    ],
  },
  {
    id: 'moderation',
    label: 'Moderation',
    icon: '⚖',
    leaves: [
      {
        label: 'Moderation queue',
        path: '/dashboard/moderation',
        countSource: 'moderation.queue',
        icon: '⚖',
        keywords: [
          'reports',
          'queue',
          'takedown',
          'listing reports',
          'social',
          'forum',
          'daylight',
        ],
      },
      {
        label: 'Daylight notices',
        path: '/dashboard/daylight',
        icon: '☀',
        keywords: ['takedown', 'copyright', 'daylight feed', 'all towns'],
      },
      {
        label: 'Social moderation',
        path: '/dashboard/social-governance',
        countSource: 'moderation.social',
        icon: '⚖',
        keywords: ['posts', 'reports', 'governance', 'social'],
      },
      {
        label: 'Forum moderation',
        path: '/dashboard/forum-governance',
        countSource: 'moderation.forum',
        icon: '⚖',
        keywords: ['threads', 'reports', 'governance', 'forum'],
      },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    icon: '¤',
    leaves: [
      {
        label: 'Store overview',
        path: '/dashboard/store/overview',
        icon: '¤',
        keywords: ['revenue', 'sales'],
      },
      {
        label: 'Products',
        path: '/dashboard/store/products',
        icon: '▤',
        keywords: ['catalog', 'stock', 'pricing'],
      },
      {
        label: 'Catalog',
        path: '/dashboard/store/business-site',
        icon: '▥',
        keywords: ['business site', 'offers', 'services'],
      },
      {
        label: 'Orders',
        path: '/dashboard/store/orders',
        countSource: 'commerce.orders',
        icon: '▧',
        keywords: ['fulfillment', 'purchases'],
      },
      {
        label: 'Appointments',
        path: '/dashboard/store/appointments',
        countSource: 'commerce.appointments',
        icon: '◷',
        keywords: ['bookings', 'schedule'],
      },
      {
        label: 'Availability',
        path: '/dashboard/store/availability',
        icon: '◶',
        keywords: ['hours', 'bookings', 'capacity'],
      },
      {
        label: 'Resources',
        path: '/dashboard/store/resources',
        icon: '◫',
        keywords: ['staff', 'rooms', 'bookings'],
      },
      {
        label: 'Leads',
        path: '/dashboard/contacts',
        countSource: 'leads.new',
        icon: '✉',
        keywords: ['crm', 'contacts', 'inquiries'],
      },
    ],
  },
  {
    id: 'apps',
    label: 'Apps & sites',
    icon: '▣',
    leaves: [
      {
        label: 'Registry',
        path: '/dashboard/registry',
        icon: '▣',
        keywords: ['applications', 'domains', 'apps.yaml'],
      },
      {
        label: 'App configs',
        path: '/dashboard/app-config',
        countSource: 'experience.configs',
        icon: '⚙',
        keywords: ['configurations', 'publish', 'layouts'],
      },
      {
        label: 'Config designer',
        path: '/dashboard/app-config/designer',
        icon: '✎',
        keywords: ['new configuration', 'design', 'editor'],
      },
      {
        label: 'Themes',
        path: '/dashboard/theme',
        icon: '◐',
        keywords: ['brand', 'colour', 'color', 'palette'],
      },
      {
        label: 'Tenants',
        path: '/dashboard/tenants',
        icon: '▤',
        keywords: ['whitebox', 'clients', 'appliance', 'hardware'],
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: '⚙',
    leaves: [
      {
        label: 'Service health',
        path: '/dashboard/operations',
        icon: '♥',
        keywords: ['operations', 'status', 'uptime', 'services'],
      },
      {
        label: 'Deployments & OAuth',
        path: '/dashboard/deployments',
        icon: '⇪',
        keywords: ['rollouts', 'releases', 'control center', 'providers'],
      },
      {
        label: 'Security',
        path: '/dashboard/security',
        icon: '⛨',
        keywords: ['observability', 'audit', 'threats'],
      },
      {
        label: 'Performance',
        path: '/dashboard/performance',
        icon: '◔',
        keywords: ['observability', 'latency', 'speed'],
      },
      {
        label: 'Video processing',
        path: '/dashboard/video-processing',
        icon: '▶',
        keywords: ['transcode', 'media', 'queue'],
      },
    ],
  },
];

/** Every leaf with its group, in tree order. */
export function flattenNav(
  nav: readonly OwnerNavGroup[] = OWNER_NAV
): OwnerNavEntry[] {
  return nav.flatMap((group) => group.leaves.map((leaf) => ({ group, leaf })));
}

/** Strip query string, fragment and trailing slash from a router URL. */
export function pathOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

const segmentsOf = (path: string): string[] =>
  path.split('/').filter((segment) => segment !== '');

/** Whether the leading segments of `url` match `pattern` (`:x` matches any). */
function matchesPrefix(pattern: string, url: string): boolean {
  const want = segmentsOf(pattern);
  const have = segmentsOf(url);
  return (
    want.length <= have.length &&
    want.every((segment, i) => segment.startsWith(':') || segment === have[i])
  );
}

/**
 * The nav entry that best matches a URL: the longest leaf whose path equals the
 * URL or is a whole-segment prefix of it, so `/dashboard/app-config/designer`
 * selects its own leaf rather than `/dashboard/app-config`.
 */
export function findNavEntry(
  url: string,
  nav: readonly OwnerNavGroup[] = OWNER_NAV
): OwnerNavEntry | undefined {
  const path = pathOf(url);
  return flattenNav(nav)
    .filter((entry) => matchesPrefix(entry.leaf.path, path))
    .sort(
      (a, b) => segmentsOf(b.leaf.path).length - segmentsOf(a.leaf.path).length
    )[0];
}

/** Path of the active leaf, for highlighting the sidebar. */
export function activeNavPath(
  url: string,
  nav: readonly OwnerNavGroup[] = OWNER_NAV
): string | undefined {
  return findNavEntry(url, nav)?.leaf.path;
}

const detailLabel = (segment: string): string => {
  if (/^[a-z][a-z-]*$/i.test(segment) && segment.length <= 16) {
    const words = segment.replace(/-/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return 'Details';
};

/**
 * Breadcrumbs for a URL: group › page, then one crumb per detail segment below
 * the page (`/communities/abc/members` gives Details › Members).
 */
export function breadcrumbsFor(
  url: string,
  nav: readonly OwnerNavGroup[] = OWNER_NAV,
  town?: { id: string; name: string } | null
): OwnerBreadcrumb[] {
  const entry = findNavEntry(url, nav);
  if (!entry) {
    return [];
  }
  const { group, leaf } = entry;
  const path = pathOf(url);
  const leafDepth = segmentsOf(leaf.path).length;
  const detail = segmentsOf(path).slice(leafDepth);

  if (group.id === 'home') {
    return [{ label: leaf.label }];
  }

  const crumbs: OwnerBreadcrumb[] = [{ label: group.label }];
  if (leaf.needsTown && town && !leaf.path.endsWith('/overview')) {
    crumbs.push({
      label: town.name,
      path: resolveLeafPath(
        { ...leaf, path: '/dashboard/towns/:townId/overview' },
        town.id
      ) as string,
    });
  }
  const pageUrl = `/${segmentsOf(path).slice(0, leafDepth).join('/')}`;
  crumbs.push({ label: leaf.label, path: detail.length ? pageUrl : undefined });
  detail.forEach((segment, index) => {
    crumbs.push({
      label: detailLabel(segment),
      path:
        index < detail.length - 1
          ? `${pageUrl}/${detail.slice(0, index + 1).join('/')}`
          : undefined,
    });
  });
  return crumbs;
}

/** Drop leaves the owner lacks permission for; drop groups left empty. */
export function filterNavByPermission(
  can: (permission: string) => boolean,
  nav: readonly OwnerNavGroup[] = OWNER_NAV
): OwnerNavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      leaves: group.leaves.filter(
        (leaf) => !leaf.requiredPermission || can(leaf.requiredPermission)
      ),
    }))
    .filter((group) => group.leaves.length > 0);
}

/** A leaf's real route: `:townId` filled in, or null while no town is picked. */
export function resolveLeafPath(
  leaf: OwnerNavLeaf,
  townId: string | null | undefined
): string | null {
  if (!leaf.needsTown) {
    return leaf.path;
  }
  return townId
    ? leaf.path.replace(':townId', encodeURIComponent(townId))
    : null;
}

/**
 * Fill in each entry's `href`. Town pages get the selected town's id; with no
 * town they point at the picker and carry a `hint` so the UI can say why.
 */
export function resolveNavEntries(
  entries: readonly OwnerNavEntry[],
  townId: string | null | undefined
): OwnerNavEntry[] {
  return entries.map((entry) => {
    const href = resolveLeafPath(entry.leaf, townId);
    return href === null
      ? { ...entry, href: TOWNS_PATH, hint: PICK_A_TOWN }
      : { ...entry, href };
  });
}

/** Leaves the owner can navigate to (town pages resolve via the context). */
export function navigableEntries(
  nav: readonly OwnerNavGroup[] = OWNER_NAV
): OwnerNavEntry[] {
  return flattenNav(nav);
}

/** Score a query against a haystack: lower is better, -1 for no match. */
function scoreText(query: string, text: string): number {
  const index = text.indexOf(query);
  if (index === 0) {
    return 0;
  }
  if (index > 0) {
    return text[index - 1] === ' ' ? 1 : 2;
  }
  let cursor = 0;
  let gaps = 0;
  for (const char of query) {
    const found = text.indexOf(char, cursor);
    if (found === -1) {
      return -1;
    }
    gaps += found - cursor;
    cursor = found + 1;
  }
  return 3 + Math.min(gaps, 50) / 50;
}

/**
 * Fuzzy match over label, group and keywords. Label matches outrank group and
 * keyword matches; an empty query returns every entry in tree order.
 */
export function searchNav(
  query: string,
  entries: readonly OwnerNavEntry[]
): OwnerNavEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...entries];
  }
  return entries
    .map((entry, order) => {
      const label = scoreText(q, entry.leaf.label.toLowerCase());
      const other = scoreText(
        q,
        [entry.group.label, ...(entry.leaf.keywords ?? [])]
          .join(' ')
          .toLowerCase()
      );
      const score =
        label >= 0 ? label : other >= 0 ? other + 5 : Number.POSITIVE_INFINITY;
      return { entry, score, order };
    })
    .filter((row) => Number.isFinite(row.score))
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map((row) => row.entry);
}
