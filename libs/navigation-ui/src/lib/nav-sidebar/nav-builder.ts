import { NavItem } from './nav-sidebar.component';

export interface AppShellNavLink {
  label: string;
  route?: string;
  description?: string;
  exact?: boolean;
  children?: readonly AppShellNavLink[];
}

export interface BuildAppShellNavOptions {
  isAuthenticated: boolean;
  currentUrl: string;
  navigate: (route: string) => void;
  authAction: () => void;
  links?: AppShellNavLink[];
  guestLinks?: AppShellNavLink[];
  loginLabel?: string;
  logoutLabel?: string;
}

function matchesRoute(
  currentUrl: string,
  route: string | undefined,
  exact = false
): boolean {
  if (!route) {
    return false;
  }

  const path = currentUrl.split(/[?#]/)[0] ?? currentUrl;

  return exact
    ? path === route
    : path === route || path.startsWith(`${route}/`);
}

function mapLink(
  link: AppShellNavLink,
  currentUrl: string,
  navigate: (route: string) => void
): NavItem {
  const children = link.children?.map((child) =>
    mapLink(child, currentUrl, navigate)
  );
  const childActive = children?.some((child) => child.isActive) ?? false;

  return {
    label: link.label,
    description: link.description,
    isActive: childActive || matchesRoute(currentUrl, link.route, link.exact),
    action: link.route ? () => navigate(link.route as string) : undefined,
    children,
  };
}

export function buildAppShellNavItems({
  isAuthenticated,
  currentUrl,
  navigate,
  authAction,
  links = [],
  guestLinks = [],
  loginLabel = 'Login',
  logoutLabel = 'Logout',
}: BuildAppShellNavOptions): NavItem[] {
  const authItem: NavItem = {
    label: isAuthenticated ? logoutLabel : loginLabel,
    action: authAction,
  };

  const sourceLinks = isAuthenticated ? links : guestLinks;

  return [
    authItem,
    ...sourceLinks.map((link) => mapLink(link, currentUrl, navigate)),
  ];
}
