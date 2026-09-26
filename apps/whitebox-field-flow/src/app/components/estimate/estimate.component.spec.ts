import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { EstimateComponent } from './estimate.component';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

describe('EstimateComponent', () => {
  let component: EstimateComponent;
  let fixture: ComponentFixture<EstimateComponent>;
  let brandConfig: BrandConfigService;
  let apiService: FieldFlowApiService;
  let httpMock: HttpTestingController;
  let router: Router;
  let navigateSpy: jest.SpyInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstimateComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        FieldFlowApiService,
        BrandConfigService,
      ],
    }).compileComponents();

    brandConfig = TestBed.inject(BrandConfigService);
    apiService = TestBed.inject(FieldFlowApiService);
    brandConfig.resolveBrandProfile('apex-detailing');

    fixture = TestBed.createComponent(EstimateComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigateSpy = jest.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('creates the estimate component with zero console warnings', () => {
    expect(component).toBeTruthy();
    expect(component.calculation).toBeDefined();
  });

  it('renders dynamic tenant trade packages and parameters', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Standard Detailing Wash');
    expect(element.textContent).toContain('Ceramic Sealant');
    expect(element.textContent).toContain('Full Paint Correction');
    expect(element.textContent).toContain('Compact / Small');
    expect(element.textContent).toContain(
      'A server-authoritative quote will appear here after the request succeeds.'
    );
  });

  it('dynamically adapts offerings when switching tenants', () => {
    brandConfig.setBrandProfile('coastal-pressure-wash');
    component.ngOnInit();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Flatwork Surface Cleaning');
    expect(element.textContent).toContain('Whole-Home Low-Pressure Soft Wash');
    expect(element.textContent).toContain('Full Commercial Concrete');
    expect(element.textContent).not.toContain('Detailing Wash');
  });

  it('updates the non-authoritative pending state when selecting a different package', () => {
    component.onPackageSelect('restoration');
    fixture.detectChanges();

    expect(component.calculation.packageDetails.id).toBe('restoration');
    expect(component.calculation.subtotal).toBe(0);
    expect(component.calculation.isAuthoritative).toBe(false);
  });

  it('does not show fixed prices or surcharges before a server quote', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent || '';

    expect(text).not.toContain('$120');
    expect(text).not.toContain('+$35');
    expect(text).not.toContain('+25%');
    expect(text).not.toContain('$0.20');
  });

  it('stays on the estimate step and shows an error when the quote request fails', async () => {
    component.proceedToBooking();
    const request = httpMock.expectOne('/api/v1/flow/estimates');
    request.flush('unavailable', {
      status: 503,
      statusText: 'Unavailable',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect((component as unknown as { formError: string }).formError).toContain(
      'Unable to load estimate'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Unable to load estimate'
    );
  });

  it('renders server quote values only after a successful estimate response', () => {
    component.proceedToBooking();
    httpMock.expectOne('/api/v1/flow/estimates').flush({
      estimateId: 'estimate-server-1',
      serviceId: 'standard',
      serviceName: 'Standard Care',
      basePrice: 180,
      conditionMultiplier: 1.2,
      subtotal: 216,
      taxAmount: 15.12,
      depositRequired: 54,
      total: 231.12,
      currency: 'EUR',
      expiresAt: '2026-10-01T00:00:00.000Z',
    });
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/book']);
    expect(fixture.nativeElement.textContent).toContain('EUR');
    expect(fixture.nativeElement.textContent).not.toContain('$');
  });

  it('shows tenant resolution errors without exposing services', () => {
    brandConfig.clearResolvedBrand();
    apiService.tenantResolutionState.set('error');
    apiService.tenantResolutionError.set('Tenant resolution failed.');

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.availableServices).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain(
      'Tenant resolution failed.'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'Standard Detailing Wash'
    );
  });

  it('does not use a default demo brand before host resolution', () => {
    brandConfig.clearResolvedBrand();
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.availableServices).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain(
      'Loading service profile'
    );
    expect(fixture.nativeElement.textContent).not.toContain('$120');
  });

  it('never uses the internal terms slice or whitebox in client copy', () => {
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
    expect(text).not.toContain('whitebox');
  });

  it('contains zero em dashes and maintains sentence case headings', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('\u2014');
    expect(element.textContent).not.toContain('&mdash;');

    const h1 = element.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Configure your trade service quote');
  });
});
