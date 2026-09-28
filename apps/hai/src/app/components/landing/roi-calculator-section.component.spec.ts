import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { RoiCalculatorSectionComponent } from './roi-calculator-section.component';
import {
  DEFAULT_HARDWARE_TIERS,
  HardwareCatalogService,
} from '../../services/hardware-catalog.service';
import { RoiCalculatorService } from '../../services/roi-calculator.service';

describe('RoiCalculatorSectionComponent', () => {
  let component: RoiCalculatorSectionComponent;
  let fixture: ComponentFixture<RoiCalculatorSectionComponent>;

  const tiers = [
    {
      id: 'tier1',
      tierNumber: 1,
      name: 'Compact Edge Appliance',
      formFactor: 'Mini-PC',
      hardware: 'Mini-PC',
      ram: '16GB',
      storage: '512GB',
      network: 'Dual GbE',
      powerAndProtection: 'UPS',
      targetUsers: '10 to 50 users',
      wholesaleCost: 522.22,
      marginRate: 0.35,
      marginAmount: 182.78,
      retailPrice: 705,
      leaseMonthlyRate: 99,
      softwareMonthlyRate: 50,
      inStock: true,
      stockStatus: 'In stock',
      configuratorPreset: 'tier1',
    },
  ];

  const setup = async (tiersValue: unknown) => {
    await TestBed.configureTestingModule({
      imports: [RoiCalculatorSectionComponent],
      providers: [
        RoiCalculatorService,
        {
          provide: HardwareCatalogService,
          useValue: {
            getTiers: () =>
              tiersValue instanceof Error
                ? throwError(() => tiersValue)
                : of(tiersValue),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoiCalculatorSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('loads tiers and computes an honest comparison', async () => {
    await setup(tiers);

    expect(component.result).toBeTruthy();
    expect(component.result?.haiTotal).toBeGreaterThan(0);
    expect(component.result?.cloudTotal).toBeGreaterThan(0);
    expect(fixture.nativeElement.textContent).toContain('Five-year savings');
    expect(fixture.nativeElement.textContent).toContain('quote contingency');
  });

  it('emits a prefill message with the computed figures', async () => {
    await setup(tiers);

    const emitted: string[] = [];
    component.emailComparison.subscribe((message) => emitted.push(message));
    component.requestEmailComparison();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toContain('Compact Edge Appliance');
    expect(emitted[0]).toContain('Five-year savings');
    expect(emitted[0]).toContain('Break-even');
  });

  it('recalculates the five-year comparison when inputs change', async () => {
    await setup(tiers);
    const initialCloudTotal = component.result?.cloudTotal;

    component.monthlySpend = 0;
    component.annualUplift = 0;
    component.recalculate();

    expect(component.result?.cloudTotal).toBe(0);
    expect(component.result?.savings).toBe(-3775.5);
    expect(component.result?.cloudTotal).not.toBe(initialCloudTotal);
  });

  it('uses the same lease amount published for the selected hardware tier', async () => {
    const publishedTier = DEFAULT_HARDWARE_TIERS[0];
    await setup(DEFAULT_HARDWARE_TIERS);

    component.acquisition = 'lease-36';
    component.recalculate();
    fixture.detectChanges();

    expect(component.result?.haiMonthlyLeasePayment).toBe(
      publishedTier.leaseMonthlyRate
    );
    expect(component.result?.haiHardwareTotal).toBe(
      publishedTier.leaseMonthlyRate * 36
    );
    expect(fixture.nativeElement.textContent).toContain(
      'published catalog lease rate'
    );
  });

  it('treats an empty numeric input as invalid instead of zero', async () => {
    await setup(tiers);
    const spendInput = fixture.nativeElement.querySelector(
      '#roiSpend'
    ) as HTMLInputElement;
    spendInput.value = '';
    spendInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.monthlySpend).toBeNull();
    expect(component.result).toBeNull();
    expect(component.formError).toContain('Current monthly spend');
  });

  it('updates the bound number input and comparison from user input', async () => {
    await setup(tiers);
    const spendInput = fixture.nativeElement.querySelector(
      '#roiSpend'
    ) as HTMLInputElement;
    spendInput.value = '0';
    spendInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.monthlySpend).toBe(0);
    expect(component.result?.cloudTotal).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('-$3,776');
  });

  it('shows a truthful error when tiers are unavailable', async () => {
    await setup(new Error('catalog down'));

    expect(component.result).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Hardware tiers are unavailable'
    );
  });
});
