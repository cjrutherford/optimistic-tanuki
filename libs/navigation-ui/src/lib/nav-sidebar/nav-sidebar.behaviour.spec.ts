import { NavItem, NavSidebarComponent } from './nav-sidebar.component';

/**
 * The component takes no dependencies, so it is exercised directly rather than
 * through TestBed — its template pulls in the button, card and modal
 * components, none of which this logic depends on.
 */
describe('NavSidebarComponent behaviour', () => {
  let component: NavSidebarComponent;

  beforeEach(() => {
    component = new NavSidebarComponent();
  });

  it('announces a close request', () => {
    const closed = jest.fn();
    component.close.subscribe(closed);

    component.onClose();

    expect(closed).toHaveBeenCalled();
  });

  it('tracks nav items by their position', () => {
    expect(component.navItemTrackBy(3, { label: 'Home' })).toBe(3);
  });

  describe('clicking an item', () => {
    it('runs the action and closes the drawer behind it', () => {
      const closed = jest.fn();
      component.close.subscribe(closed);
      const action = jest.fn();
      component.mode = 'drawer';

      component.onNavItemClick({ label: 'Home', action });

      expect(action).toHaveBeenCalled();
      expect(closed).toHaveBeenCalled();
    });

    it('runs the action but stays open when docked', () => {
      const closed = jest.fn();
      component.close.subscribe(closed);
      const action = jest.fn();
      component.mode = 'docked';

      component.onNavItemClick({ label: 'Home', action });

      expect(action).toHaveBeenCalled();
      // A docked sidebar is permanent furniture, not something to dismiss.
      expect(closed).not.toHaveBeenCalled();
    });

    it('does nothing for an item with no action', () => {
      const closed = jest.fn();
      component.close.subscribe(closed);
      component.mode = 'drawer';

      component.onNavItemClick({ label: 'Section heading' });

      expect(closed).not.toHaveBeenCalled();
    });
  });

  describe('variant selection', () => {
    it.each<[string, NavItem, string]>([
      [
        'active items win over their own variant',
        { label: 'a', isActive: true, variant: 'danger' },
        'primary',
      ],
      [
        'an inactive item keeps its variant',
        { label: 'a', variant: 'warning' },
        'warning',
      ],
      ['an item with neither falls back to text', { label: 'a' }, 'text'],
    ])('%s', (_case, item, expected) => {
      expect(component.getVariant(item)).toBe(expected);
    });
  });
});
