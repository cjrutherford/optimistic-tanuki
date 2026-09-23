import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { BillingController } from './billing.controller';
import {
  BillingCommands,
  InvoicePreviewMeter,
  PeriodInvoicePreviewInput,
} from '@optimistic-tanuki/billing-contracts';

describe('BillingController', () => {
  let controller: BillingController;
  const billingClient = {
    send: jest.fn(),
  };

  const meter: InvoicePreviewMeter = {
    id: 'meter-1',
    name: 'API calls',
    unit: 'call',
    includedQuantity: 1000,
    overageUnitPriceCents: 5,
  };

  beforeEach(() => {
    billingClient.send.mockReset();
    controller = new BillingController(billingClient as any);
  });

  it('records usage via RECORD_USAGE', async () => {
    billingClient.send.mockReturnValue(of({ accepted: true }));
    const dto = {
      tenantId: 'tenant-1',
      appScope: 'finance',
      meterId: 'meter-1',
      eventKey: 'api.call',
      quantity: 3,
    };

    await controller.recordUsage(dto as any);

    expect(billingClient.send).toHaveBeenCalledWith(
      { cmd: BillingCommands.RECORD_USAGE },
      dto
    );
  });

  it('records batches via BATCH_RECORD_USAGE', async () => {
    billingClient.send.mockReturnValue(of([]));
    const dto = {
      events: [
        {
          tenantId: 'tenant-1',
          appScope: 'finance',
          meterId: 'meter-1',
          eventKey: 'api.call',
          quantity: 3,
        },
      ],
    };

    await controller.batchRecordUsage(dto as any);

    expect(billingClient.send).toHaveBeenCalledWith(
      { cmd: BillingCommands.BATCH_RECORD_USAGE },
      dto
    );
  });

  it('previews instant invoices via PREVIEW_INVOICE', async () => {
    billingClient.send.mockReturnValue(of({ subtotalCents: 100 }));
    const dto = {
      tenantId: 'tenant-1',
      appScope: 'finance',
      currency: 'USD',
      subscriptionPriceCents: 9900,
      meter,
      usageQuantity: 1250,
      usageBlockBalance: 100,
    };

    await controller.previewInvoice(dto as any);

    expect(billingClient.send).toHaveBeenCalledWith(
      { cmd: BillingCommands.PREVIEW_INVOICE },
      dto
    );
  });

  it('previews period invoices via PREVIEW_INVOICE', async () => {
    billingClient.send.mockReturnValue(of({ subtotalCents: 200 }));
    const dto: PeriodInvoicePreviewInput = {
      tenantId: 'tenant-1',
      appScope: 'finance',
      accountId: 'account-1',
      currency: 'USD',
      subscriptionPriceCents: 9900,
      meter,
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-30T00:00:00.000Z'),
    };

    await controller.previewInvoice(dto);

    expect(billingClient.send).toHaveBeenCalledWith(
      { cmd: BillingCommands.PREVIEW_INVOICE },
      dto
    );
  });

  it('rejects malformed preview payloads with 400 before any TCP hop', async () => {
    await expect(
      controller.previewInvoice({ currency: 'USD' } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(billingClient.send).not.toHaveBeenCalled();
  });

  it.each([
    [{ statusCode: 400, message: 'bad scope' }, BadRequestException],
    [{ statusCode: 404, message: 'no meter' }, NotFoundException],
    [{ message: 'boom' }, InternalServerErrorException],
  ])('maps microservice errors to HTTP (%p)', async (error, expected) => {
    billingClient.send.mockReturnValue(throwError(() => error));

    await expect(
      controller.recordUsage({
        tenantId: 'tenant-1',
        appScope: 'finance',
        meterId: 'meter-1',
        eventKey: 'api.call',
        quantity: 1,
      } as any)
    ).rejects.toBeInstanceOf(expected);
  });
});
