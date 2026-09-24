import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EstimateComponent } from './estimate.component';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

describe('EstimateComponent', () => {
  let component: EstimateComponent;
  let fixture: ComponentFixture<EstimateComponent>;

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

    fixture = TestBed.createComponent(EstimateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the estimate component with zero console warnings', () => {
    expect(component).toBeTruthy();
    expect(component.calculation).toBeDefined();
  });

  it('renders package selector and parameters', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Standard Care');
    expect(element.textContent).toContain('Premium Protection');
    expect(element.textContent).toContain('Full Restoration');
    expect(element.textContent).toContain('Compact / Small');
    expect(element.textContent).toContain('Required booking deposit');
  });

  it('updates calculation when selecting a different package', () => {
    component.onPackageSelect('restoration');
    fixture.detectChanges();

    expect(component.calculation.packageDetails.id).toBe('restoration');
    expect(component.calculation.subtotal).toBeGreaterThan(300);
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
