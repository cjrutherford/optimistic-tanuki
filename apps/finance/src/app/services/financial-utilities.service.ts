import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import {
  CreateFinancialCheckoutSessionDto,
  CreateFinancialInvoiceDto,
  FinancialInvoiceLineDto,
  RecordFinancialInvoicePaymentDto,
  UpdateFinancialInvoiceDto,
} from '@optimistic-tanuki/models';
import { FinancialInvoice } from '../../entities/financial-invoice.entity';
import { FinancialCheckoutSession } from '../../entities/financial-checkout-session.entity';
import { TransactionService } from './transaction.service';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

@Injectable()
export class FinancialUtilitiesService {
  constructor(
    @InjectRepository(FinancialInvoice)
    private readonly invoiceRepo: Repository<FinancialInvoice>,
    @InjectRepository(FinancialCheckoutSession)
    private readonly checkoutRepo: Repository<FinancialCheckoutSession>,
    private readonly transactionService: TransactionService
  ) {}

  private invoiceTotal(lines: FinancialInvoiceLineDto[]): number {
    return lines.reduce(
      (sum, line) => sum + Number(line.quantity) * Number(line.unitAmount),
      0
    );
  }

  private invoiceNumber(): string {
    const date = new Date();
    const stamp = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('');
    const suffix = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `FIN-${stamp}-${suffix}`;
  }

  async createInvoice(
    input: CreateFinancialInvoiceDto
  ): Promise<FinancialInvoice> {
    if (!input.lines?.length) {
      throw new BadRequestException('Invoice requires at least one line item.');
    }

    const subtotal = this.invoiceTotal(input.lines);
    const invoice = this.invoiceRepo.create({
      ...input,
      invoiceNumber: this.invoiceNumber(),
      workspace: input.workspace ?? 'business',
      currency: input.currency ?? 'USD',
      customerEmail: input.customerEmail ?? null,
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      subtotal,
      total: subtotal,
      amountPaid: 0,
      status: 'draft',
    });

    return this.invoiceRepo.save(invoice);
  }

  async listInvoices(
    scope?: FinanceScope,
    options?: FindManyOptions<FinancialInvoice>
  ): Promise<FinancialInvoice[]> {
    return this.invoiceRepo.find(
      withScopedFindManyOptions(scope, {
        ...options,
        order: options?.order ?? { createdAt: 'DESC' },
      })
    );
  }

  async getInvoice(
    id: string,
    scope?: FinanceScope
  ): Promise<FinancialInvoice> {
    const invoice = await this.invoiceRepo.findOne(
      withScopedFindOneOptions(id, scope)
    );
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return invoice;
  }

  async updateInvoice(
    id: string,
    input: UpdateFinancialInvoiceDto,
    scope?: FinanceScope
  ): Promise<FinancialInvoice> {
    const invoice = await this.getInvoice(id, scope);
    if (invoice.status === 'paid' || invoice.status === 'void') {
      throw new BadRequestException('Paid or void invoices cannot be edited.');
    }

    const nextLines = input.lines ?? invoice.lines;
    const subtotal = this.invoiceTotal(nextLines);
    Object.assign(invoice, {
      ...input,
      lines: nextLines,
      subtotal,
      total: subtotal,
      customerEmail: input.customerEmail ?? invoice.customerEmail,
      notes: input.notes ?? invoice.notes,
      dueDate: input.dueDate ?? invoice.dueDate,
    });

    return this.invoiceRepo.save(invoice);
  }

  async sendInvoice(
    id: string,
    scope?: FinanceScope
  ): Promise<FinancialInvoice> {
    const invoice = await this.getInvoice(id, scope);
    if (invoice.status === 'draft') {
      invoice.status = 'sent';
      invoice.sentAt = new Date();
    }
    return this.invoiceRepo.save(invoice);
  }

  async voidInvoice(
    id: string,
    scope?: FinanceScope
  ): Promise<FinancialInvoice> {
    const invoice = await this.getInvoice(id, scope);
    if (invoice.status === 'paid') {
      throw new BadRequestException('Paid invoices cannot be voided.');
    }
    invoice.status = 'void';
    return this.invoiceRepo.save(invoice);
  }

  async recordInvoicePayment(
    id: string,
    input: RecordFinancialInvoicePaymentDto,
    scope?: FinanceScope
  ): Promise<FinancialInvoice> {
    const invoice = await this.getInvoice(id, scope);
    if (invoice.status === 'void') {
      throw new BadRequestException('Void invoices cannot be paid.');
    }

    const amountPaid = Number(invoice.amountPaid ?? 0) + Number(input.amount);
    invoice.amountPaid = amountPaid;
    invoice.status =
      amountPaid >= Number(invoice.total) ? 'paid' : 'partially_paid';
    invoice.paidAt =
      invoice.status === 'paid' ? input.paidAt ?? new Date() : null;

    await this.transactionService.create({
      amount: Number(input.amount),
      type: 'credit',
      accountId: input.accountId,
      category: 'invoice-payment',
      description: `Invoice payment from ${invoice.customerName}`,
      reference: invoice.invoiceNumber,
      transactionDate: input.paidAt ?? new Date(),
      isRecurring: false,
      userId: invoice.userId,
      profileId: invoice.profileId,
      tenantId: invoice.tenantId,
      appScope: invoice.appScope,
      workspace: invoice.workspace,
      payeeOrVendor: invoice.customerName,
      transferType: input.method,
    });

    return this.invoiceRepo.save(invoice);
  }

  async createCheckoutSession(
    input: CreateFinancialCheckoutSessionDto
  ): Promise<FinancialCheckoutSession> {
    if (input.invoiceId) {
      await this.getInvoice(input.invoiceId, {
        userId: input.userId,
        profileId: input.profileId,
        tenantId: input.tenantId,
        appScope: input.appScope,
      });
    }

    const session = this.checkoutRepo.create({
      ...input,
      invoiceId: input.invoiceId ?? null,
      workspace: input.workspace ?? 'business',
      currency: input.currency ?? 'USD',
      customerEmail: input.customerEmail ?? null,
      description: input.description ?? null,
      successUrl: input.successUrl ?? null,
      cancelUrl: input.cancelUrl ?? null,
      providerReference: null,
      providerCheckoutUrl: null,
      status: 'pending_provider',
    });

    return this.checkoutRepo.save(session);
  }

  async listCheckoutSessions(
    scope?: FinanceScope,
    options?: FindManyOptions<FinancialCheckoutSession>
  ): Promise<FinancialCheckoutSession[]> {
    return this.checkoutRepo.find(
      withScopedFindManyOptions(scope, {
        ...options,
        order: options?.order ?? { createdAt: 'DESC' },
      })
    );
  }

  async getCheckoutSession(
    id: string,
    scope?: FinanceScope
  ): Promise<FinancialCheckoutSession> {
    const session = await this.checkoutRepo.findOne(
      withScopedFindOneOptions(id, scope)
    );
    if (!session) {
      throw new NotFoundException(`Checkout session with ID ${id} not found`);
    }
    return session;
  }
}
