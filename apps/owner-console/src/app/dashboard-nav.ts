import { OPERATOR_WORKSPACES } from './operator-workspaces';

export interface DashboardNavEntry {
  label: string;
  route: string;
}

/**
 * Workspaces whose landing is a bespoke component. Their `cards` are never
 * rendered, so every card route is surfaced in the sidebar until S1 replaces
 * this list with a grouped nav model.
 */
export const BESPOKE_WORKSPACE_PATHS: readonly string[] = [
  'community-ops',
  'experience',
];

const STOPGAP_ENTRIES: DashboardNavEntry[] = OPERATOR_WORKSPACES.filter(
  (workspace) => BESPOKE_WORKSPACE_PATHS.includes(workspace.path)
).flatMap((workspace) =>
  workspace.cards.map((card) => ({ label: card.title, route: card.route }))
);

export const DASHBOARD_NAV_ENTRIES: DashboardNavEntry[] = [
  { label: 'Overview', route: '/dashboard/overview' },
  ...OPERATOR_WORKSPACES.map((workspace) => ({
    label: workspace.label,
    route: `/dashboard/${workspace.path}`,
  })),
  { label: 'Operations', route: '/dashboard/operations' },
  { label: 'Video Processing', route: '/dashboard/video-processing' },
  { label: 'Security', route: '/dashboard/security' },
  { label: 'Performance', route: '/dashboard/performance' },
  { label: 'Control Center', route: '/dashboard/control-center' },
  ...STOPGAP_ENTRIES.filter(
    (entry) =>
      !OPERATOR_WORKSPACES.some(
        (workspace) => `/dashboard/${workspace.path}` === entry.route
      )
  ),
];

/** Strip query string and fragment from a router URL. */
const pathOf = (url: string): string => url.split(/[?#]/)[0];

/**
 * The nav route that best matches a URL: the longest route that is equal to
 * the URL or a whole-segment prefix of it, so `/dashboard/app-config/designer`
 * selects its own entry rather than `/dashboard/app-config`.
 */
export function activeNavRoute(
  url: string,
  entries: readonly DashboardNavEntry[] = DASHBOARD_NAV_ENTRIES
): string | undefined {
  const path = pathOf(url);
  return entries
    .map((entry) => entry.route)
    .filter((route) => path === route || path.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];
}
