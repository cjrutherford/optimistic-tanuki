import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import {
  HardwareService,
  Chassis,
  HardwareTier,
} from '../../services/hardware.service';
import { ConfiguratorStateService } from '../../state/configurator-state.service';
import { LandingComponent } from './landing.component';

const chassis: Chassis[] = [
  {
    id: 's-cloud',
    type: 'S',
    useCase: 'hybrid',
    name: 'Compact chassis',
    description: 'Compact system',
    basePrice: 100,
    specifications: {
      formFactor: 'Mini-PC',
      maxPower: '12W',
      noiseLevel: 'Quiet',
      dimensions: 'Small',
    },
    isActive: true,
  },
  {
    id: 'm-cloud',
    type: 'M',
    useCase: 'dev',
    name: 'Tower chassis',
    description: 'Tower system',
    basePrice: 200,
    specifications: {
      formFactor: 'Tower',
      maxPower: '100W',
      noiseLevel: 'Quiet',
      dimensions: 'Medium',
    },
    isActive: true,
  },
  {
    id: 'l-nas',
    type: 'L',
    useCase: 'nas',
    name: 'Rack chassis',
    description: 'Rack system',
    basePrice: 300,
    specifications: {
      formFactor: '2U',
      maxPower: '500W',
      noiseLevel: 'Moderate',
      dimensions: 'Large',
    },
    isActive: true,
  },
];

const tiers = [
  {
    id: 'tier1',
    tierNumber: 1,
    name: 'Compact Edge Appliance',
    formFactor: 'Mini-PC',
    hardware: 'Compact system',
    ram: '16GB RAM',
    storage: '512GB NVMe',
    network: 'Dual 2.5 GbE',
    powerAndProtection: '12W UPS protected',
    targetUsers: '10 to 50 users',
    inStock: true,
    stockStatus: 'In stock',
    configuratorPreset: 'tier1',
    wholesaleCost: 522.22,
    marginRate: 0.35,
    marginAmount: 182.78,
    retailPrice: 705,
    leaseMonthlyRate: 99,
  },
  {
    id: 'tier2',
    tierNumber: 2,
    name: 'Workstation Tower Appliance',
    formFactor: 'Tower',
    hardware: 'Workstation tower',
    ram: '32GB RAM',
    storage: 'Dual 1TB NVMe',
    network: 'Dual 2.5 GbE',
    powerAndProtection: 'UPS protected',
    targetUsers: '50 to 250 users',
    inStock: true,
    stockStatus: 'In stock',
    configuratorPreset: 'tier2',
    wholesaleCost: 2111.11,
    marginRate: 0.35,
    marginAmount: 738.89,
    retailPrice: 2850,
    retailPriceMax: 3200,
    leaseMonthlyRate: 199,
  },
  {
    id: 'tier3',
    tierNumber: 3,
    name: 'Enterprise Rackmount Appliance',
    formFactor: '2U Rackmount',
    hardware: 'Enterprise rack system',
    ram: '64GB RAM',
    storage: 'Enterprise NVMe',
    network: 'Dual 10 GbE',
    powerAndProtection: 'Redundant power',
    targetUsers: '250+ users',
    inStock: true,
    stockStatus: 'Available on build order',
    configuratorPreset: 'tier3',
    wholesaleCost: 2370.37,
    marginRate: 0.35,
    marginAmount: 829.63,
    retailPrice: 3200,
    leaseMonthlyRate: 349,
  },
] as unknown as HardwareTier[];

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;
  let router: { navigate: jest.Mock };
  let state: { setDraft: jest.Mock; setPriceBreakdown: jest.Mock };
  let tiersResponse: Subject<HardwareTier[]>;

  const createComponent = (preset: string | null = null) => {
    tiersResponse = new Subject<HardwareTier[]>();
    router = { navigate: jest.fn() };
    state = { setDraft: jest.fn(), setPriceBreakdown: jest.fn() };
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        {
          provide: HardwareService,
          useValue: {
            getChassis: () => of(chassis),
            getTiers: () => tiersResponse.asObservable(),
          },
        },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(preset ? { preset } : {}),
            },
          },
        },
        { provide: ConfiguratorStateService, useValue: state },
      ],
    });
    fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
  };

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('shows public hardware tiers without displaying any catalog price or margin values', () => {
    createComponent();
    tiersResponse.next(tiers);
    fixture.detectChanges();

    const page = fixture.nativeElement.textContent as string;
    expect(page).toContain('Compact Edge Appliance');
    expect(page).toContain('Workstation Tower Appliance');
    expect(page).toContain('Enterprise Rackmount Appliance');
    expect(page).toContain(
      'confirms pricing in a written quote valid for 30 days.'
    );
    expect(page).not.toMatch(
      /\$\s?(705|2,850|3,200|99|199|349|522\.22|2,111\.11)/
    );
    expect(page).not.toMatch(/wholesale|margin/i);
  });

  it.each([
    ['tier1', 's-cloud'],
    ['tier2', 'm-cloud'],
    ['tier3', 'l-nas'],
  ])(
    'preserves the %s deep link through the matching configuration draft',
    (preset, chassisId) => {
      createComponent(preset);
      tiersResponse.next(tiers);
      fixture.detectChanges();
      expect(state.setDraft).toHaveBeenCalledWith(
        expect.objectContaining({ chassisId })
      );
      expect(router.navigate).toHaveBeenCalledWith(['/configure', chassisId], {
        queryParams: { preset },
      });
    }
  );

  it('offers keyboard focusable tier actions that open the matching preset configuration', () => {
    createComponent();
    tiersResponse.next(tiers);
    fixture.detectChanges();

    const action = fixture.nativeElement.querySelector(
      '[data-tier="tier2"] button'
    ) as HTMLButtonElement;
    action.focus();
    expect(document.activeElement).toBe(action);
    action.click();
    expect(router.navigate).toHaveBeenCalledWith(['/configure', 'm-cloud'], {
      queryParams: { preset: 'tier2' },
    });
  });

  it('keeps the existing chassis picker configuration action working', () => {
    createComponent();
    const chassisButton = fixture.nativeElement.querySelector(
      '.system-card'
    ) as HTMLButtonElement;
    chassisButton.click();
    expect(router.navigate).toHaveBeenCalledWith(['/configure', 's-cloud']);
  });

  it('shows loading and error states while the tier catalog is unavailable', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    createComponent();
    expect(fixture.nativeElement.textContent).toContain(
      'Loading HAI system tiers...'
    );

    tiersResponse.error(new Error('offline'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'HAI system tiers are unavailable right now. Please retry shortly.'
    );
    expect(fixture.nativeElement.querySelectorAll('[data-tier]').length).toBe(
      0
    );
  });
});
