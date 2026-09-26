import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { appRoutes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';
import { FieldFlowApiService } from './services/field-flow-api.service';

describe('AppComponent', () => {
  let brandConfig: BrandConfigService;
  let tenantApi: { initializeTenant: jest.Mock };

  beforeEach(async () => {
    tenantApi = { initializeTenant: jest.fn(() => of({})) };
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FieldFlowApiService, useValue: tenantApi },
      ],
    }).compileComponents();

    brandConfig = TestBed.inject(BrandConfigService);
  });

  it('renders the application shell without whitebox in title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app.title).toContain('Field Flow');
    expect(app.title.toLowerCase()).not.toContain('whitebox');
  });

  it('initializes the server-resolved tenant in the browser', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(tenantApi.initializeTenant).toHaveBeenCalledTimes(1);
  });

  it('never uses the term slice in client-facing elements', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
  });

  it('exposes only customer routes', () => {
    const paths = appRoutes.map((route) => route.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        'estimate',
        'login',
        'register',
        'book',
        'deposit',
        'status/:id',
      ])
    );
    expect(paths).not.toEqual(
      expect.arrayContaining(['operations', 'demo', 'field-flow/demo'])
    );
  });

  it('does not link to demo status or operations surfaces', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('a')
    ).map((link) => link.getAttribute('href'));

    expect(links).not.toContain('/status/demo-job');
    expect(links).not.toContain('/operations');
  });
});
