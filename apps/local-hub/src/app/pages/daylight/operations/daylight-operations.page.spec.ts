import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DaylightOperationsPage } from './daylight-operations.page';

describe('DaylightOperationsPage', () => {
  it('renders the shared operations component and links back to the towns for non-operators', async () => {
    TestBed.configureTestingModule({
      imports: [DaylightOperationsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DaylightOperationsPage);
    fixture.detectChanges();
    http
      .expectOne('/api/local-hub/me')
      .flush({ data: { permissions: ['contribution.create'], roles: [] } });
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ot-daylight-operations h1')?.textContent).toBe(
      'Operations'
    );
    expect(page.textContent).toContain('This page is for Daylight operators.');
    expect(page.querySelector('a')?.getAttribute('href')).toBe('/cities');
    http.verify();
  });
});
