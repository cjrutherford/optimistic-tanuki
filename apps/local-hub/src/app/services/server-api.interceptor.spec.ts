import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { serverApiInterceptor } from './server-api.interceptor';

function setUp(platform: 'server' | 'browser', base: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([serverApiInterceptor])),
      provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: platform },
      { provide: API_BASE_URL, useValue: base },
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    controller: TestBed.inject(HttpTestingController),
  };
}

describe('serverApiInterceptor', () => {
  it('sends relative API calls to the gateway when rendering on the server', () => {
    const { http, controller } = setUp('server', 'http://gateway:3000/api');
    http.get('/api/local-hub/editions/adel-ga').subscribe();
    controller
      .expectOne('http://gateway:3000/api/local-hub/editions/adel-ga')
      .flush({});
    controller.verify();
  });

  it('leaves absolute and non-API URLs alone', () => {
    const { http, controller } = setUp('server', 'http://gateway:3000/api');
    http.get('https://example.com/api/x').subscribe();
    http.get('/assets/i18n.json').subscribe();
    controller.expectOne('https://example.com/api/x').flush({});
    controller.expectOne('/assets/i18n.json').flush({});
    controller.verify();
  });

  it('does nothing in the browser', () => {
    const { http, controller } = setUp('browser', '/api');
    http.get('/api/local-hub/editions').subscribe();
    controller.expectOne('/api/local-hub/editions').flush({});
    controller.verify();
  });
});
