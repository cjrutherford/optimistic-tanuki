import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { appConfig } from './app.config';

describe('appConfig', () => {
  beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...(appConfig.providers ?? [])],
    });
  });

  it('provides /api as the application API base URL', () => {
    expect(TestBed.inject(API_BASE_URL)).toBe('/api');
  });
});
