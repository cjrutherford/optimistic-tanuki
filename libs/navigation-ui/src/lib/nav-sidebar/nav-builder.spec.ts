import { buildAppShellNavItems } from './nav-builder';

describe('buildAppShellNavItems', () => {
  it('builds auth-aware nav items with active state and descriptions', () => {
    const navigate = jest.fn();
    const authAction = jest.fn();

    const items = buildAppShellNavItems({
      isAuthenticated: true,
      currentUrl: '/projects',
      navigate,
      authAction,
      links: [
        {
          label: 'Workspace',
          description: 'Primary work areas',
          children: [
            {
              label: 'Projects',
              route: '/projects',
              description: 'Plan and execute active work',
            },
          ],
        },
      ],
    });

    expect(items[0].label).toBe('Logout');
    expect(items[1].children?.[0]).toEqual(
      expect.objectContaining({
        label: 'Projects',
        description: 'Plan and execute active work',
        isActive: true,
      })
    );

    items[1].children?.[0].action?.();
    expect(navigate).toHaveBeenCalledWith('/projects');
  });

  it('switches to guest auth action and guest links when unauthenticated', () => {
    const items = buildAppShellNavItems({
      isAuthenticated: false,
      currentUrl: '/register',
      navigate: jest.fn(),
      authAction: jest.fn(),
      guestLinks: [
        {
          label: 'Register',
          route: '/register',
        },
      ],
    });

    expect(items[0].label).toBe('Login');
    expect(items[1]).toEqual(
      expect.objectContaining({
        label: 'Register',
        isActive: true,
      })
    );
  });
});
