import { FormUiPageComponent } from './pages/form-ui/form-ui-page.component';
import { MotionUiPageComponent } from './pages/motion-ui/motion-ui-page.component';
import { NavigationUiPageComponent } from './pages/navigation-ui/navigation-ui-page.component';
import { NotificationUiPageComponent } from './pages/notification-ui/notification-ui-page.component';
import { SocialUiPageComponent } from './pages/social-ui/social-ui-page.component';

describe('ui-playground catalog metadata', () => {
  it('covers the full motion-ui component set', () => {
    const component = new MotionUiPageComponent();

    expect(component.elements.map((element) => element.id)).toEqual([
      'aurora',
      'signal-mesh',
      'murmuration',
      'particle',
      'topographic-drift',
      'pulse',
      'beam',
      'glass-fog',
      'parallax-grid-warp',
    ]);
  });

  it('exposes height controls for each motion-ui component that supports height', () => {
    const component = new MotionUiPageComponent();

    const heightEnabledIds = component.elements
      .filter((element) =>
        element.props.some((prop) => prop.name === 'height')
      )
      .map((element) => element.id);

    expect(heightEnabledIds).toEqual([
      'aurora',
      'signal-mesh',
      'murmuration',
      'particle',
      'topographic-drift',
      'pulse',
      'beam',
      'glass-fog',
      'parallax-grid-warp',
    ]);
  });

  it('covers the full form-ui primitive set', () => {
    const component = new FormUiPageComponent();

    expect(component.elements.map((element) => element.id)).toEqual([
      'text-input',
      'text-area',
      'checkbox',
      'radio-button',
      'select',
      'image-upload',
    ]);
  });

  it('covers the full navigation-ui component set', () => {
    const component = new NavigationUiPageComponent();

    expect(component.elements.map((element) => element.id)).toEqual([
      'app-bar',
      'nav-sidebar',
    ]);
  });

  it('covers the key social-ui composition surface', () => {
    const component = new SocialUiPageComponent();

    expect(component.elements.map((element) => element.id)).toEqual([
      'compose',
      'comment',
      'comment-list',
      'post',
    ]);
  });

  it('covers the full notification-ui component set', () => {
    const component = new NotificationUiPageComponent();

    expect(component.elements.map((element) => element.id)).toEqual([
      'notification-bell',
      'notification-list',
    ]);
  });
});
