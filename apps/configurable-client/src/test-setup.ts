import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
  writable: true,
});
