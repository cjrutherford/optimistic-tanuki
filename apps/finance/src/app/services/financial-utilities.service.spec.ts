import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialInvoice } from '../../entities/financial-invoice.entity';
import { FinancialCheckoutSession } from '../../entities/financial-checkout-session.entity';
import { FinancialUtilitiesService } from './financial-utilities.service';
import { TransactionService } from './transaction.service';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => value),
  },
}));

describe('FinancialUtilitiesService', () => {
  let service: FinancialUtilitiesService;
  let invoiceRepo: jest.Mocked<Repository<FinancialInvoice>>;
  let checkoutRepo: jest.Mocked<Repository<FinancialCheckoutSession>>;
  let transactionService: { create: jest.Mock };

  const repoFactory = () => ({
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve(value)),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  });

  beforeEach(async () => {
    transactionService = {
      create: jest.fn().mockResolvedValue({ id: 'transaction-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialUtilitiesService,
        {
          provide: getRepositoryToken(FinancialInvoice),
          useFactory: repoFactory,
        },
        {
          provide: getRepositoryToken(FinancialCheckoutSession),
          useFactory: repoFactory,
        },
        {
          provide: TransactionService,
          useValue: transactionService,
        },
      ],
    }).compile();

    service = module.get(FinancialUtilitiesService);
    invoiceRepo = module.get(getRepositoryToken(FinancialInvoice));
    checkoutRepo = module.get(getRepositoryToken(FinancialCheckoutSession));
  });

  it('creates scoped business invoices with computed totals and generated invoice numbers', async () => {
    invoiceRepo.save.mockImplementation(
      async (invoice) =>
        ({
          id: 'invoice-1',
          ...invoice,
        } as FinancialInvoice)
    );

    const invoice = await service.createInvoice({
      userId: 'user-1',
      profileId: 'profile-1',
      tenantId: 'tenant-1',
      appScope: 'finance',
      workspace: 'business',
      customerName: 'Acme Bakery',
      customerEmail: 'ops@acme.test',
      currency: 'USD',
      dueDate: new Date('2026-07-01T00:00:00.000Z'),
      lines: [
        {
          description: 'Retainer',
          quantity: 1,
          unitAmount: 500,
        },
        {
          description: 'Implementation hours',
          quantity: 3,
          unitAmount: 125,
        },
      ],
    });

    expect(invoice.invoiceNumber).toMatch(/^FIN-/);
    expect(invoice.subtotal).toBe(875);
    expect(invoice.total).toBe(875);
    expect(invoice.status).toBe('draft');
    expect(invoiceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        workspace: 'business',
        customerName: 'Acme Bakery',
      })
    );
  });

  it('records invoice payments as localized finance transactions', async () => {
    const invoice = {
      id: 'invoice-1',
      invoiceNumber: 'FIN-20260602-0001',
      userId: 'user-1',
      profileId: 'profile-1',
      tenantId: 'tenant-1',
      appScope: 'finance',
      workspace: 'business',
      customerName: 'Acme Bakery',
      total: 500,
      amountPaid: 0,
      status: 'sent',
    } as FinancialInvoice;

    invoiceRepo.findOne.mockResolvedValue(invoice);
    invoiceRepo.save.mockImplementation(
      async (value) => value as FinancialInvoice
    );

    const paid = await service.recordInvoicePayment(
      'invoice-1',
      {
        amount: 500,
        accountId: 'account-1',
        paidAt: new Date('2026-06-03T00:00:00.000Z'),
        method: 'card',
      },
      {
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      }
    );

    expect(paid.status).toBe('paid');
    expect(paid.amountPaid).toBe(500);
    expect(transactionService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 500,
        type: 'credit',
        accountId: 'account-1',
        workspace: 'business',
        category: 'invoice-payment',
        reference: 'FIN-20260602-0001',
      })
    );
  });

  it('creates checkout sessions linked to invoices and business workspace context', async () => {
    const invoice = {
      id: 'invoice-1',
      userId: 'user-1',
      profileId: 'profile-1',
      tenantId: 'tenant-1',
      appScope: 'finance',
      workspace: 'business',
      customerName: 'Acme Bakery',
      customerEmail: 'ops@acme.test',
      currency: 'USD',
      total: 500,
    } as FinancialInvoice;

    invoiceRepo.findOne.mockResolvedValue(invoice);
    checkoutRepo.save.mockImplementation(
      async (session) =>
        ({
          id: 'checkout-1',
          ...session,
        } as FinancialCheckoutSession)
    );

    const session = await service.createCheckoutSession({
      userId: 'user-1',
      profileId: 'profile-1',
      tenantId: 'tenant-1',
      appScope: 'finance',
      workspace: 'business',
      invoiceId: 'invoice-1',
      amount: 250,
      currency: 'USD',
      customerName: 'Acme Bakery',
      customerEmail: 'ops@acme.test',
      description: 'Deposit for invoice FIN-20260602-0001',
      successUrl: 'https://example.test/success',
      cancelUrl: 'https://example.test/cancel',
    });

    expect(session.status).toBe('pending_provider');
    expect(session.invoiceId).toBe('invoice-1');
    expect(session.workspace).toBe('business');
    expect(checkoutRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 250,
        currency: 'USD',
        customerEmail: 'ops@acme.test',
      })
    );
  });
});
