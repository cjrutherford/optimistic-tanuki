import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
  writable: true,
});
