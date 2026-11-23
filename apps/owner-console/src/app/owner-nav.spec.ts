import { Route } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  HOME_PATH,
  OWNER_NAV,
  OwnerNavGroup,
  OwnerNavLeaf,
  breadcrumbsFor,
  filterNavByPermission,
  findNavEntry,
  flattenNav,
  navigableEntries,
  resolveLeafPath,
  resolveNavEntries,
  TOWNS_PATH,
  PICK_A_TOWN,
  searchNav,
} from './owner-nav';

const dashboardChildren: Route[] =
  appRoutes.find((route) => route.path === 'dashboard')?.children ?? [];

/**
 * Routed pages that must be reachable from the nav. Redirects, the empty path
 * and parameterised children are excluded; login, register and OAuth routes
 * live outside `/dashboard`.
 */
const routedPages = dashboardChildren
  .filter((route) => !route.redirectTo)
  .map((route) => route.path ?? '')
  .filter((path) => path !== '' && !path.includes(':'));

/** Every real (non-redirect) dashboard route, parameters included. */
const routedPatterns = dashboardChildren
  .filter((route) => !route.redirectTo && route.path)
  .map((route) => `/dashboard/${route.path}`);

const leaves = flattenNav();

describe('OWNER_NAV tree', () => {
  it('has the target groups in order', () => {
    expect(OWNER_NAV.map((group) => group.label)).toEqual([
      'Home',
      'People & access',
      'Towns',
      'Directory',
      'Moderation',
      'Commerce',
      'Apps & sites',
      'System',
    ]);
  });

  it('gives groups unique ids and labels', () => {
    expect(new Set(OWNER_NAV.map((g) => g.id)).size).toBe(OWNER_NAV.length);
    expect(new Set(OWNER_NAV.map((g) => g.label)).size).toBe(OWNER_NAV.length);
  });

  it('gives leaves unique paths and labels', () => {
    const paths = leaves.map((entry) => entry.leaf.path);
    const labels = leaves.map((entry) => entry.leaf.label);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives every leaf a label, an icon and an absolute dashboard path', () => {
    for (const { leaf } of leaves) {
      expect(leaf.label.trim()).not.toBe('');
      expect(leaf.icon).not.toBe('');
      expect(leaf.path.startsWith('/dashboard/')).toBe(true);
    }
  });

  it('uses plain labels, not route slugs', () => {
    for (const { leaf } of leaves) {
      expect(leaf.label).not.toMatch(/[a-z]+-[a-z]+/);
    }
  });

  it('only marks parameterised leaves as needing a town', () => {
    for (const { leaf } of leaves) {
      expect(leaf.path.includes(':townId')).toBe(!!leaf.needsTown);
    }
  });
});

describe('route and nav coverage', () => {
  it('finds routed pages to check', () => {
    expect(routedPages.length).toBeGreaterThan(20);
  });

  it.each(routedPages)('/dashboard/%s is reachable from OWNER_NAV', (path) => {
    const target = `/dashboard/${path}`;
    expect(findNavEntry(target)).toBeDefined();
  });

  it.each(leaves.map((entry) => [entry.leaf.path]))(
    'nav entry %s points at a routed page',
    (path) => {
      expect(routedPatterns).toContain(path);
    }
  );

  it('does not keep the oauth-inspector alias route', () => {
    expect(routedPages).not.toContain('oauth-inspector');
  });

  it('routes Home as the landing page and retires the landing pages', () => {
    expect(routedPatterns).toContain(HOME_PATH);
    for (const retired of [
      'overview',
      'governance',
      'experience',
      'commerce',
      'crm',
    ]) {
      const route = dashboardChildren.find((r) => r.path === retired);
      expect(route?.redirectTo).toBeDefined();
    }
  });

  it('redirects every retired URL to a routed page', () => {
    const redirects = dashboardChildren.filter((r) => r.redirectTo && r.path);
    expect(redirects.length).toBeGreaterThan(0);
    for (const route of redirects) {
      const to = route.redirectTo as string;
      const target = to.startsWith('/') ? to : `/dashboard/${to}`;
      // Old town URLs redirect to a town page; the picker is a plain route.
      expect(
        routedPatterns.some(
          (pattern) =>
            pattern === target ||
            pattern === target.replace(':communityId', ':townId')
        )
      ).toBe(true);
    }
  });
});

describe('findNavEntry', () => {
  it('prefers the most specific leaf', () => {
    expect(findNavEntry('/dashboard/directory-taxonomy-runs')?.leaf.path).toBe(
      '/dashboard/directory-taxonomy-runs'
    );
    expect(findNavEntry('/dashboard/directory-taxonomy?x=1')?.leaf.path).toBe(
      '/dashboard/directory-taxonomy'
    );
    expect(findNavEntry('/dashboard/app-config/designer/abc')?.leaf.path).toBe(
      '/dashboard/app-config/designer'
    );
  });

  it('matches parameterised leaves and ignores other URLs', () => {
    expect(
      findNavEntry('/dashboard/towns/town-1/directory-address-review')?.leaf
        .label
    ).toBe('Address review');
    expect(findNavEntry('/login')).toBeUndefined();
  });
});

describe('breadcrumbsFor', () => {
  it('is just the page for Home', () => {
    expect(breadcrumbsFor(HOME_PATH)).toEqual([{ label: 'Home' }]);
  });

  it('shows group then page for a top-level leaf', () => {
    expect(breadcrumbsFor('/dashboard/store/orders')).toEqual([
      { label: 'Commerce' },
      { label: 'Orders' },
    ]);
  });

  it('adds detail segments for a nested route', () => {
    expect(
      breadcrumbsFor('/dashboard/communities/9f1c2d3e-aaaa-bbbb/members?x=1')
    ).toEqual([
      { label: 'Towns' },
      { label: 'Communities', path: '/dashboard/communities' },
      {
        label: 'Details',
        path: '/dashboard/communities/9f1c2d3e-aaaa-bbbb',
      },
      { label: 'Members' },
    ]);
    expect(breadcrumbsFor('/dashboard/cities/new')).toEqual([
      { label: 'Towns' },
      { label: 'Cities', path: '/dashboard/cities' },
      { label: 'New' },
    ]);
  });

  it('is empty outside the console', () => {
    expect(breadcrumbsFor('/login')).toEqual([]);
  });
});

describe('searchNav', () => {
  const entries = navigableEntries();
  const labels = (query: string): string[] =>
    searchNav(query, entries).map((entry) => entry.leaf.label);

  it('returns everything for an empty query', () => {
    expect(searchNav('  ', entries)).toHaveLength(entries.length);
  });

  it('matches labels first', () => {
    expect(labels('orders')[0]).toBe('Orders');
  });

  it('matches group names and keywords', () => {
    expect(labels('moderation')).toEqual(
      expect.arrayContaining([
        'Moderation queue',
        'Social moderation',
        'Forum moderation',
      ])
    );
    expect(labels('crm')).toContain('Leads');
  });

  it('matches fuzzily', () => {
    expect(labels('srvhlth')).toContain('Service health');
  });

  it('returns nothing for gibberish', () => {
    expect(labels('zzzqqq')).toEqual([]);
  });

  it('keeps pages that need a town in the results', () => {
    expect(labels('boundary')).toContain('Boundary review');
  });
});

describe('filterNavByPermission', () => {
  const nav: OwnerNavGroup[] = [
    {
      id: 'a',
      label: 'A',
      icon: 'a',
      leaves: [
        { label: 'Open', path: '/dashboard/open', icon: 'o' },
        {
          label: 'Locked',
          path: '/dashboard/locked',
          icon: 'l',
          requiredPermission: 'x.manage',
        },
      ],
    },
    {
      id: 'b',
      label: 'B',
      icon: 'b',
      leaves: [
        {
          label: 'Hidden',
          path: '/dashboard/hidden',
          icon: 'h',
          requiredPermission: 'y.manage',
        },
      ],
    },
  ];

  it('hides leaves the owner lacks and groups left empty', () => {
    const result = filterNavByPermission(() => false, nav);
    expect(result.map((g) => g.id)).toEqual(['a']);
    expect(result[0].leaves.map((l) => l.label)).toEqual(['Open']);
  });

  it('keeps leaves the owner holds', () => {
    const result = filterNavByPermission((p) => p === 'x.manage', nav);
    expect(result[0].leaves.map((l) => l.label)).toEqual(['Open', 'Locked']);
    expect(result).toHaveLength(1);
  });
});

describe('town pages in the nav', () => {
  const boundary = leaves.find(
    (entry) => entry.leaf.label === 'Boundary review'
  )?.leaf as OwnerNavLeaf;

  it('lists every town page under /dashboard/towns/:townId', () => {
    const townLeaves = leaves.filter((entry) => entry.leaf.needsTown);
    expect(townLeaves.length).toBeGreaterThanOrEqual(9);
    for (const { leaf } of townLeaves) {
      expect(leaf.path.startsWith('/dashboard/towns/:townId/')).toBe(true);
    }
  });

  it('fills :townId from the selected town', () => {
    expect(resolveLeafPath(boundary, 'abc 1')).toBe(
      '/dashboard/towns/abc%201/boundary-review'
    );
  });

  it('has no route for a town page while no town is selected', () => {
    expect(resolveLeafPath(boundary, null)).toBeNull();
  });

  it('resolves every entry with a town and leaves non-town pages alone', () => {
    const resolved = resolveNavEntries(navigableEntries(), 't1');
    expect(resolved.every((entry) => entry.hint === undefined)).toBe(true);
    expect(
      resolved.find((entry) => entry.leaf.label === 'Boundary review')?.href
    ).toBe('/dashboard/towns/t1/boundary-review');
    expect(resolved.find((e) => e.leaf.label === 'Users')?.href).toBe(
      '/dashboard/users'
    );
  });

  it('points town pages at the picker with a hint when no town is selected', () => {
    const resolved = resolveNavEntries(navigableEntries(), null);
    const row = resolved.find((e) => e.leaf.label === 'Boundary review');
    expect(row?.href).toBe(TOWNS_PATH);
    expect(row?.hint).toBe(PICK_A_TOWN);
    expect(
      resolved.find((e) => e.leaf.label === 'Users')?.hint
    ).toBeUndefined();
  });

  it('keeps town pages in navigableEntries', () => {
    expect(navigableEntries().some((e) => e.leaf.needsTown)).toBe(true);
  });

  it('adds the town to the breadcrumbs of a town page', () => {
    expect(
      breadcrumbsFor('/dashboard/towns/t1/boundary-review', undefined, {
        id: 't1',
        name: 'Springfield',
      })
    ).toEqual([
      { label: 'Towns' },
      { label: 'Springfield', path: '/dashboard/towns/t1/overview' },
      { label: 'Boundary review' },
    ]);
  });
});
