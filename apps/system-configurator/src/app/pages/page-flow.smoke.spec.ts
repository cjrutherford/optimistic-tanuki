import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import {
  Chassis,
  CompatibleComponents,
  HardwareService,
  Order,
  PriceBreakdown,
} from '../services/hardware.service';
import { ConfiguratorStateService } from '../state/configurator-state.service';
import { ProfileService } from '../state/profile.service';
import { ReturnIntentService } from '../state/return-intent.service';
import { LandingComponent } from './landing/landing.component';
import { ConfigureComponent } from './configure/configure.component';
import { ReviewComponent } from './review/review.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { ConfirmationComponent } from './confirmation/confirmation.component';
import { ProfileGateComponent } from './profile-gate/profile-gate.component';

const mockChassis: Chassis = {
  id: 'xs-cloud',
  type: 'XS',
  useCase: 'cloud',
  name: 'HAI XS Cloud Node',
  description: 'Raspberry Pi 5 cloud edge node with compact enclosure and low-power deployment profile.',
  basePrice: 16,
  specifications: {
    formFactor: 'Raspberry Pi 5 enclosure',
    maxPower: '27W USB-C PD',
    noiseLevel: 'Passive or near-silent',
    dimensions: 'Pi-class compact',
  },
  isActive: true,
};

const compatibleComponents: CompatibleComponents = {
  cpu: [
    {
      id: 'cpu-1',
      type: 'cpu',
      name: 'Raspberry Pi 5 8GB',
      description: '',
      basePrice: 80,
      sellingPrice: 80,
      specs: { cores: 4, frequency: '2.4 GHz ARM' },
      compatibleWith: ['xs-cloud'],
      inStock: true,
      isActive: true,
    },
  ],
  ram: [
    {
      id: 'ram-1',
      type: 'ram',
      name: '8GB LPDDR4X Onboard',
      description: '',
      basePrice: 0,
      sellingPrice: 0,
      specs: { capacity: '8GB', speed: 'LPDDR4X' },
      compatibleWith: ['xs-cloud'],
      inStock: true,
      isActive: true,
    },
  ],
  storage: [
    {
      id: 'storage-1',
      type: 'storage',
      name: '256GB NVMe for Pi HAT+',
      description: '',
      basePrice: 35,
      sellingPrice: 35,
      specs: { capacity: '256GB', type: 'NVMe SSD' },
      compatibleWith: ['xs-cloud'],
      inStock: true,
      isActive: true,
    },
  ],
  gpu: [
    {
      id: 'gpu-1',
      type: 'gpu',
      name: 'Integrated VideoCore',
      description: '',
      basePrice: 0,
      sellingPrice: 0,
      specs: { vram: 'Shared' },
      compatibleWith: ['xs-cloud'],
      inStock: true,
      isActive: true,
    },
  ],
};

const mockPrice: PriceBreakdown = {
  chassisPrice: 16,
  cpuPrice: 80,
  ramPrice: 0,
  storagePrice: 35,
  gpuPrice: 0,
  casePrice: 0,
  accessoriesPrice: 0,
  assemblyFee: 79,
  totalPrice: 210,
};

class MockConfiguratorStateService {
  readonly draft = signal({
    chassisId: 'xs-cloud',
    chassisType: 'XS',
    useCase: 'cloud',
    cpuId: 'cpu-1',
    ramId: 'ram-1',
    storageIds: ['storage-1'],
    gpuId: '',
  });
  readonly priceBreakdown = signal<PriceBreakdown | null>(mockPrice);
  readonly checkoutDraft = signal({
    shipping: {
      name: 'Alex Integrator',
      street: '204 Deployment Lane',
      city: 'Savannah',
      state: 'Georgia',
      zip: '31401',
      country: 'USA',
    },
    customerEmail: 'alex@hai.example',
    paymentMethod: 'card',
  });

  setDraft = jest.fn((draft) => this.draft.set(draft));
  patchDraft = jest.fn((patch) =>
    this.draft.set({
      ...this.draft(),
      ...patch,
    })
  );
  setPriceBreakdown = jest.fn((price) => this.priceBreakdown.set(price));
  setCheckoutDraft = jest.fn((draft) => this.checkoutDraft.set(draft));
  clear = jest.fn();
}

describe('System configurator page smoke tests', () => {
  let router: { navigate: jest.Mock };
  let hardwareService: {
    getChassis: jest.Mock;
    getChassisById: jest.Mock;
    getCompatibleComponents: jest.Mock;
    calculatePrice: jest.Mock;
    createOrder: jest.Mock;
    getOrder: jest.Mock;
  };
  let configuratorState: MockConfiguratorStateService;

  beforeEach(() => {
    router = { navigate: jest.fn() };
    hardwareService = {
      getChassis: jest.fn().mockReturnValue(of([mockChassis])),
      getChassisById: jest.fn().mockReturnValue(of(mockChassis)),
      getCompatibleComponents: jest.fn().mockReturnValue(of(compatibleComponents)),
      calculatePrice: jest.fn().mockReturnValue(of(mockPrice)),
      createOrder: jest.fn().mockReturnValue(
        of({
          id: 'order-1',
          configuration: {
            chassisId: 'xs-cloud',
            chassisType: 'XS',
            useCase: 'cloud',
            cpuId: 'cpu-1',
            ramId: 'ram-1',
            storageIds: ['storage-1'],
            gpuId: '',
          },
          priceBreakdown: mockPrice,
          shippingAddress: {
            name: 'Alex Integrator',
            street: '204 Deployment Lane',
            city: 'Savannah',
            state: 'Georgia',
            zip: '31401',
            country: 'USA',
          },
          customerEmail: 'alex@hai.example',
          paymentMethod: 'card',
          status: 'pending',
          estimatedDelivery: new Date('2026-04-30T00:00:00.000Z'),
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
        } as Order)
      ),
      getOrder: jest.fn().mockReturnValue(
        of({
          id: 'order-1',
          configuration: {
            chassisId: 'xs-cloud',
            chassisType: 'XS',
            useCase: 'cloud',
            cpuId: 'cpu-1',
            ramId: 'ram-1',
            storageIds: ['storage-1'],
            gpuId: '',
          },
          priceBreakdown: mockPrice,
          shippingAddress: {
            name: 'Alex Integrator',
            street: '204 Deployment Lane',
            city: 'Savannah',
            state: 'Georgia',
            zip: '31401',
            country: 'USA',
          },
          customerEmail: 'alex@hai.example',
          paymentMethod: 'card',
          status: 'pending',
          estimatedDelivery: new Date('2026-04-30T00:00:00.000Z'),
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
        } as Order)
      ),
    };
    configuratorState = new MockConfiguratorStateService();
  });

  async function createComponent<T>(component: T, orderId = 'order-1'): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({
      imports: [component as never],
      providers: [
        ThemeService,
        { provide: Router, useValue: router },
        { provide: HardwareService, useValue: hardwareService },
        { provide: ConfiguratorStateService, useValue: configuratorState },
        {
          provide: ProfileService,
          useValue: {
            getEffectiveProfile: jest.fn().mockReturnValue({ profileName: 'HAI Primary' }),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                chassisId: 'xs-cloud',
                orderId,
              }),
            },
          },
        },
      ],
    }).compileComponents();

    return TestBed.createComponent(component as never);
  }

  it('renders the landing page and routes into configuration', async () => {
    const fixture = await createComponent(LandingComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('HAI Computer');
    expect(fixture.nativeElement.textContent).toContain('HAI XS Cloud Node');

    fixture.componentInstance.selectChassis(mockChassis);

    expect(configuratorState.setDraft).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/configure', 'xs-cloud']);
  });

  it('renders the configure page and calculates pricing', async () => {
    const fixture = await createComponent(ConfigureComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('HAI Build Bench');
    expect(hardwareService.calculatePrice).toHaveBeenCalled();
  });

  it('renders the review page with the costed summary', async () => {
    const fixture = await createComponent(ReviewComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('HAI Preflight');
    expect(fixture.nativeElement.textContent).toContain('Estimated order total');
  });

  it('renders the checkout page with shared form and payment components', async () => {
    const fixture = await createComponent(CheckoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('HAI Order Intake');
    expect(fixture.nativeElement.textContent).toContain('Shipping and payment coordination');
  });

  it('submits checkout with the selected payment method', async () => {
    const fixture = await createComponent(CheckoutComponent);
    fixture.detectChanges();

    fixture.componentInstance.onPaymentMethodChange('zelle');
    fixture.componentInstance.submitOrder();

    expect(hardwareService.createOrder).toHaveBeenCalledWith(
      configuratorState.draft(),
      fixture.componentInstance.shipping,
      'alex@hai.example',
      'zelle'
    );
  });

  it('renders the profile gate with profile selection and creation controls', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProfileGateComponent],
      providers: [
        ThemeService,
        { provide: Router, useValue: router },
        {
          provide: ProfileService,
          useValue: {
            getCurrentUserProfiles: jest.fn().mockReturnValue([
              {
                id: 'profile-1',
                userId: 'user-1',
                profileName: 'HAI Primary',
                profilePic: '',
                coverPic: '',
                bio: '',
                location: '',
                occupation: '',
                interests: '',
                skills: '',
                appScope: 'system-configurator',
              },
            ]),
            getEffectiveProfile: jest.fn().mockReturnValue({
              id: 'profile-1',
              userId: 'user-1',
              profileName: 'HAI Primary',
              profilePic: '',
              coverPic: '',
              bio: '',
              location: '',
              occupation: '',
              interests: '',
              skills: '',
              appScope: 'system-configurator',
            }),
            getAllProfiles: jest.fn().mockResolvedValue(undefined),
            selectProfile: jest.fn(),
            createProfile: jest.fn(),
          },
        },
        {
          provide: MessageService,
          useValue: {
            addMessage: jest.fn(),
          },
        },
        {
          provide: ReturnIntentService,
          useValue: {
            consume: jest.fn().mockReturnValue('/checkout'),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileGateComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Finish your integrator profile');
    expect(fixture.nativeElement.textContent).toContain('Create a HAI profile');
  });

  it('renders the confirmation page for a completed order', async () => {
    const fixture = await createComponent(ConfirmationComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('HAI Confirmation');
    expect(fixture.nativeElement.textContent).toContain('order-1');
  });
});
