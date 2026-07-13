import { appRoutes } from './app.routes';
import { LivePlaybackComponent } from './pages/live-playback/live-playback.component';

describe('appRoutes', () => {
  it('defines a dedicated live watch contract route for channel handoff playback', () => {
    expect(appRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'watch/live/:slugOrId',
          component: LivePlaybackComponent,
        }),
      ])
    );
  });
});
