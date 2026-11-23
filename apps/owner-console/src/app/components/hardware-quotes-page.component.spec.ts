import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import {
  CommercialQuote,
  HardwareQuotesService,
  OperatorSupplierOffer,
} from '../services/hardware-quotes.service';
import { HardwareQuotesPageComponent } from './hardware-quotes-page.component';
import {
  OwnerConfirmStub,
  createOwnerConfirmStub,
} from './owner-confirm.testing';

const fresh = new Date(Date.now() - 60_000).toISOString();

function offer(
  overrides: Partial<OperatorSupplierOffer> = {}
): OperatorSupplierOffer {
  return {
    id: 'offer-live-1',
    vendor: 'CDW',
    sourceSku: 'SKU-123',
    productName: 'Rack server chassis',
    amount: 1000,
    currency: 'USD',
    availability: 'in_stock',
    observedAt: fresh,
    sourceChannel: 'live-api',
    ...overrides,
  };
}

function quote(overrides: Partial<CommercialQuote> = {}): CommercialQuote {
  return {
    id: 'server-quote-42',
    sourceCost: 1000,
    currency: 'USD',
    pricingSnapshot: { pricingModel: 'pass-through', outrightPrice: 1484.5 },
    issuedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    version: 'commercial-pricing-v1',
    state: 'issued',
    ...overrides,
  };
}

describe('HardwareQuotesPageComponent', () => {
  let fixture: ComponentFixture<HardwareQuotesPageComponent>;
  let confirmStub: OwnerConfirmStub;
  let hardware: {
    getSupplierOffers: jest.Mock;
    issueCommercialQuote: jest.Mock;
    acceptCommercialQuote: jest.Mock;
    commitCommercialProposal: jest.Mock;
    searchAmazonBusinessOffers: jest.Mock;
    downloadClientDeploymentArtifacts: jest.Mock;
  };

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HardwareQuotesPageComponent],
      providers: [
        { provide: HardwareQuotesService, useValue: hardware },
        { provide: OwnerConfirmService, useValue: confirmStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HardwareQuotesPageComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    confirmStub = createOwnerConfirmStub();
    hardware = {
      getSupplierOffers: jest.fn().mockReturnValue(of([])),
      issueCommercialQuote: jest.fn().mockReturnValue(of(quote())),
      acceptCommercialQuote: jest
        .fn()
        .mockReturnValue(of(quote({ state: 'accepted' }))),
      commitCommercialProposal: jest.fn().mockReturnValue(of({ id: 'lead-7' })),
      searchAmazonBusinessOffers: jest.fn().mockReturnValue(of([])),
      downloadClientDeploymentArtifacts: jest
        .fn()
        .mockReturnValue(of(new Blob(['bundle']))),
    };
  });

  it('shows Unavailable with a Retry when supplier offers fail to load', async () => {
    hardware.getSupplierOffers.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Gateway timed out' } }))
    );
    await createComponent();

    const state = fixture.nativeElement.querySelector('ot-owner-state');
    expect(state.getAttribute('data-kind')).toBe('error');
    expect(state.textContent).toContain('Gateway timed out');

    hardware.getSupplierOffers.mockReturnValue(of([offer()]));
    state.querySelector('button').click();
    fixture.detectChanges();

    expect(hardware.getSupplierOffers).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelectorAll('.offer-row')).toHaveLength(
      1
    );
  });

  it('only enables live, in-stock USD offers observed within seven days', async () => {
    hardware.getSupplierOffers.mockReturnValue(
      of([
        offer(),
        offer({ id: 'offer-import', sourceChannel: 'file-import' }),
        offer({ id: 'offer-backorder', availability: 'backorder' }),
        offer({ id: 'offer-eur', currency: 'EUR' }),
        offer({
          id: 'offer-stale',
          observedAt: new Date(
            Date.now() - 8 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }),
      ])
    );
    await createComponent();

    const rows: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.offer-row')
    );
    expect(rows).toHaveLength(5);
    const enabled = rows.filter(
      (row) =>
        !(row.querySelector('input[type="checkbox"]') as HTMLInputElement)
          .disabled
    );
    expect(enabled).toHaveLength(1);
    expect(enabled[0].textContent).toContain('Rack server chassis');
    for (const row of rows.slice(1)) {
      expect(
        (row.querySelector('input[type="checkbox"]') as HTMLInputElement)
          .disabled
      ).toBe(true);
    }
    expect(rows[1].textContent).toContain(
      'File imported; live API source required.'
    );
    expect(rows[2].textContent).toContain('not currently in stock');
    expect(rows[3].textContent).toContain('priced in USD');
    expect(rows[4].textContent).toContain('older than seven days');
  });

  it('issues and accepts a quote, then commits using the server quote ID', async () => {
    hardware.getSupplierOffers.mockReturnValue(of([offer()]));
    const issued = quote();
    const accepted = quote({ state: 'accepted' });
    hardware.issueCommercialQuote.mockReturnValue(of(issued));
    hardware.acceptCommercialQuote.mockReturnValue(of(accepted));
    await createComponent();

    const component = fixture.componentInstance;
    component.toggleOffer(offer(), true);
    component.freightAmount = 24.5;
    component.taxAmount = 70;
    component.setupHours = 6;
    component.monthlySupportHours = 2;
    component.monthlyCloudCost = 50;
    component.monthlySmsCost = 20;
    component.monthlyNetworkCost = 30;
    component.issueQuote();

    expect(hardware.issueCommercialQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        tierId: 'tier1',
        items: [{ offerId: 'offer-live-1', quantity: 1 }],
        freightAmount: 24.5,
        taxAmount: 70,
        setupHours: 6,
        monthlySupportHours: 2,
      })
    );
    expect(component.quote()?.id).toBe('server-quote-42');

    await component.acceptQuote();
    expect(confirmStub.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'reason' })
    );
    expect(hardware.acceptCommercialQuote).toHaveBeenCalledWith(
      'server-quote-42'
    );
    expect(component.quote()?.state).toBe('accepted');

    component.customerName = 'Example Customer';
    component.customerEmail = 'customer@example.test';
    component.customerPhone = '555-0100';
    await component.commitProposal();
    expect(confirmStub.confirm).toHaveBeenCalledTimes(2);
    expect(hardware.commitCommercialProposal).toHaveBeenCalledWith(
      'server-quote-42',
      {
        customerName: 'Example Customer',
        customerEmail: 'customer@example.test',
        customerPhone: '555-0100',
      }
    );
  });

  it('starts owner-requested Amazon search and refreshes offers after success', async () => {
    hardware.getSupplierOffers.mockReturnValue(of([offer()]));
    hardware.searchAmazonBusinessOffers.mockReturnValue(of([offer()]));
    await createComponent();
    const component = fixture.componentInstance;
    component.amazonKeywords = 'rack server';
    component.shippingPostalCode = '10001';

    component.searchAmazonOffers();

    expect(hardware.searchAmazonBusinessOffers).toHaveBeenCalledWith({
      keywords: 'rack server',
      shippingPostalCode: '10001',
    });
    expect(hardware.getSupplierOffers).toHaveBeenCalledTimes(2);
    expect(component.offers()).toEqual([offer()]);
    expect(component.actionError()).toBe('');
    expect(component.successMessage()).toContain('Amazon Business');
  });

  it('shows a safe message when live Amazon search is unavailable', async () => {
    hardware.searchAmazonBusinessOffers.mockReturnValue(
      throwError(() => ({
        error: {
          message: 'provider response contained private credential material',
        },
      }))
    );
    await createComponent();
    const component = fixture.componentInstance;
    component.amazonKeywords = 'rack server';

    component.searchAmazonOffers();

    expect(component.actionError()).toBe(
      'Amazon Business live search failed. Check API account access and try again.'
    );
    expect(component.actionError()).not.toContain('private credential');
  });

  it('does not accept the quote when the owner cancels the confirmation', async () => {
    hardware.getSupplierOffers.mockReturnValue(of([offer()]));
    confirmStub.confirm.mockResolvedValue({ confirmed: false });
    await createComponent();
    fixture.componentInstance.quote.set(quote());

    await fixture.componentInstance.acceptQuote();

    expect(hardware.acceptCommercialQuote).not.toHaveBeenCalled();
  });

  it('downloads the accepted quote deployment bundle using the entered customer endpoints', async () => {
    hardware.getSupplierOffers.mockReturnValue(of([offer()]));
    hardware.downloadClientDeploymentArtifacts.mockReturnValue(
      of(new Blob(['bundle']))
    );
    await createComponent();
    const component = fixture.componentInstance;
    component.quote.set(quote({ state: 'accepted' }));
    component.deploymentOrganization = 'Example Customer';
    component.deploymentContactName = 'Owner Person';
    component.deploymentImageTag = '2026.09.28';
    component.deploymentGatewayUrl = 'https://gateway.example.test';
    component.deploymentGatewayWsUrl = 'wss://gateway.example.test';
    component.deploymentSocketUrl = 'https://gateway.example.test/socket.io';

    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const createObjectUrl = jest.fn().mockReturnValue('blob:deployment-bundle');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    const revokeObjectUrl = jest.fn();
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await component.downloadBundle();

    expect(hardware.downloadClientDeploymentArtifacts).toHaveBeenCalledWith(
      'server-quote-42',
      {
        organization: 'Example Customer',
        contactName: 'Owner Person',
        imageTag: '2026.09.28',
        gatewayUrl: 'https://gateway.example.test',
        gatewayWsUrl: 'wss://gateway.example.test',
        socketUrl: 'https://gateway.example.test/socket.io',
      }
    );
    expect(component.successMessage()).toContain('download');
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    if (originalCreateObjectUrl) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: originalCreateObjectUrl,
      });
    } else {
      delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    }
    if (originalRevokeObjectUrl) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: originalRevokeObjectUrl,
      });
    } else {
      delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    }
  });
});
