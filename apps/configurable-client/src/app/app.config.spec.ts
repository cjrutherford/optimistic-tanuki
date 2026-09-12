import { APP_INITIALIZER } from '@angular/core';
import { appConfig } from './app.config';

describe('configurable-client appConfig', () => {
  it('does not restore a session during anonymous application bootstrap', () => {
    expect(appConfig.providers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provide: APP_INITIALIZER }),
      ])
    );
  });
});
