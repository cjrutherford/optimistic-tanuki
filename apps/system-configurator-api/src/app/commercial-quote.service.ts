import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import type { CommercialQuote } from '@optimistic-tanuki/models';
import {
  addQuoteExpiryDays,
  assessRetainerMargin,
  calculateHardwareCommercialPricing,
} from '../hardware/commercial-pricing';
import { CommercialQuoteEntity } from '../hardware/entities/commercial-quote.entity';
import { SupplierOfferEntity } from '../hardware/entities/supplier-offer.entity';

export const COMMERCIAL_QUOTE_CLOCK = Symbol('COMMERCIAL_QUOTE_CLOCK');
const MAX_OFFER_AGE_DAYS = 7;
const MAX_OFFER_AGE_MS = MAX_OFFER_AGE_DAYS * 24 * 60 * 60 * 1000;
const QUOTE_VERSION = 'commercial-pricing-v1';

export interface IssueCommercialQuoteInput {
  tierId: string;
  items: Array<{ offerId: string; quantity: number }>;
  monthlyRetainerRevenue: number;
  monthlyCloudCost: number;
  monthlySmsCost: number;
  monthlyNetworkCost: number;
  idempotencyKey: string;
}

interface NormalizedIssueInput extends IssueCommercialQuoteInput {
  items: Array<{ offerId: string; quantity: number }>;
}

type Clock = () => Date;

@Injectable()
export class CommercialQuoteService {
  constructor(
    @InjectRepository(SupplierOfferEntity)
    private readonly offerRepository: Repository<SupplierOfferEntity>,
    @InjectRepository(CommercialQuoteEntity)
    private readonly quoteRepository: Repository<CommercialQuoteEntity>,
    @Optional()
    @Inject(COMMERCIAL_QUOTE_CLOCK)
    private readonly clock: Clock = () => new Date()
  ) {}

  async issueQuote(input: IssueCommercialQuoteInput): Promise<CommercialQuote> {
    const normalized = this.normalizeInput(input);
    const existing = await this.quoteRepository.findOne({
      where: { idempotencyKey: normalized.idempotencyKey },
    });
    if (existing) return this.returnOrRejectRetry(existing, normalized);

    const issuedAt = this.clock();
    if (!(issuedAt instanceof Date) || !Number.isFinite(issuedAt.getTime())) {
      throw new BadRequestException(
        'The quote clock returned an invalid date.'
      );
    }

    const offers = await this.offerRepository.find({
      where: { id: In(normalized.items.map(({ offerId }) => offerId)) },
    });
    const offersById = new Map(offers.map((offer) => [offer.id, offer]));
    if (offersById.size !== normalized.items.length) {
      throw new NotFoundException(
        'One or more selected supplier offers were not found.'
      );
    }

    const sourceOffers = normalized.items.map(({ offerId, quantity }) => {
      const offer = offersById.get(offerId);
      if (!offer) {
        throw new NotFoundException(`Supplier offer ${offerId} was not found.`);
      }
      if (offer.sourceChannel !== 'live-api') {
        throw new BadRequestException(
          `Supplier offer ${offerId} is not verified from a live distributor API and cannot support a firm quote.`
        );
      }
      const unitAmountCents = this.toCents(
        offer.amount,
        `Offer ${offerId} amount`
      );
      const observedAt = new Date(offer.observedAt);
      const ageMs = issuedAt.getTime() - observedAt.getTime();
      if (!Number.isFinite(observedAt.getTime()) || ageMs < 0) {
        throw new BadRequestException(
          `Supplier offer ${offerId} has an invalid or future observation time.`
        );
      }
      if (ageMs > MAX_OFFER_AGE_MS) {
        throw new BadRequestException(
          `Supplier offer ${offerId} is older than the ${MAX_OFFER_AGE_DAYS}-day freshness window.`
        );
      }
      if (offer.currency !== 'USD') {
        throw new BadRequestException(
          `Supplier offer ${offerId} must be priced in USD.`
        );
      }
      if (offer.availability !== 'in_stock') {
        throw new BadRequestException(
          `Supplier offer ${offerId} must be in stock.`
        );
      }
      const lineAmountCents = unitAmountCents * quantity;
      if (!Number.isSafeInteger(lineAmountCents)) {
        throw new BadRequestException(
          `Supplier offer ${offerId} total is too large.`
        );
      }
      return {
        offerId: offer.id,
        vendor: offer.vendor,
        sourceId: offer.sourceId,
        sourceSku: offer.sourceSku,
        productName: offer.productName,
        sourceUrl: offer.sourceUrl,
        hardwarePartId: offer.hardwarePartId,
        quantity,
        unitAmount: unitAmountCents / 100,
        lineAmount: lineAmountCents / 100,
        currency: offer.currency,
        observedAt: observedAt.toISOString(),
      };
    });

    const sourceCostCents = sourceOffers.reduce(
      (total, item) => total + Math.round(item.lineAmount * 100),
      0
    );
    if (!Number.isSafeInteger(sourceCostCents)) {
      throw new BadRequestException(
        'Selected supplier offer total is too large.'
      );
    }
    const sourceCost = sourceCostCents / 100;
    const pricing = calculateHardwareCommercialPricing({
      costBasis: { kind: 'raw', wholesaleCost: sourceCost },
    });
    if (normalized.monthlyRetainerRevenue <= 0) {
      throw new BadRequestException(
        'monthlyRetainerRevenue must be greater than zero.'
      );
    }
    const retainerMargin = assessRetainerMargin({
      monthlyRevenue: normalized.monthlyRetainerRevenue,
      monthlyCloudCost: normalized.monthlyCloudCost,
      monthlySmsCost: normalized.monthlySmsCost,
      monthlyNetworkCost: normalized.monthlyNetworkCost,
    });
    if (!retainerMargin.meetsMinimumMargin) {
      throw new BadRequestException(
        'Monthly retainer gross margin must be at least 70%.'
      );
    }

    const validUntil = new Date(addQuoteExpiryDays(issuedAt));
    const quote = this.quoteRepository.create({
      sourceCost,
      currency: 'USD',
      inputs: {
        request: normalized,
        tierId: normalized.tierId,
        sourceOffers,
        retainerMargin,
      },
      terms: {
        tierId: normalized.tierId,
        currency: 'USD',
        issuedAt: issuedAt.toISOString(),
        validUntil: validUntil.toISOString(),
        offerFreshnessWindowDays: MAX_OFFER_AGE_DAYS,
        minimumRetainerGrossMargin: 0.7,
      },
      pricingSnapshot: {
        policyVersion: QUOTE_VERSION,
        contingencyPlacement: 'reserve-only',
        ...pricing,
      },
      issuedAt,
      validUntil,
      version: QUOTE_VERSION,
      state: 'issued',
      idempotencyKey: normalized.idempotencyKey,
    });

    try {
      return this.toQuoteContract(await this.quoteRepository.save(quote));
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const concurrentQuote = await this.quoteRepository.findOne({
        where: { idempotencyKey: normalized.idempotencyKey },
      });
      if (concurrentQuote)
        return this.returnOrRejectRetry(concurrentQuote, normalized);
      throw error;
    }
  }

  async getQuote(quoteId: string): Promise<CommercialQuote> {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId },
    });
    if (!quote) throw new NotFoundException('Commercial quote was not found.');
    return this.toQuoteContract(quote);
  }

  async acceptQuote(quoteId: string): Promise<CommercialQuote> {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId },
    });
    if (!quote) throw new NotFoundException('Commercial quote was not found.');

    // Repeated acceptance is a safe retry even after the original valid window.
    if (quote.state === 'accepted') return this.toQuoteContract(quote);
    if (quote.state !== 'issued') {
      throw new ConflictException(
        `A ${quote.state} commercial quote cannot be accepted.`
      );
    }

    const now = this.clock();
    if (quote.validUntil.getTime() <= now.getTime()) {
      await this.quoteRepository.update(
        { id: quoteId, state: 'issued', validUntil: LessThanOrEqual(now) },
        { state: 'expired' }
      );
      throw new ConflictException('The commercial quote has expired.');
    }

    const result = await this.quoteRepository.update(
      { id: quoteId, state: 'issued', validUntil: MoreThan(now) },
      { state: 'accepted' }
    );
    if (result.affected !== 1) {
      const current = await this.quoteRepository.findOne({
        where: { id: quoteId },
      });
      if (current?.state === 'accepted') return this.toQuoteContract(current);
      throw new ConflictException(
        'The commercial quote is no longer current and cannot be accepted.'
      );
    }

    const accepted = await this.quoteRepository.findOne({
      where: { id: quoteId },
    });
    if (!accepted)
      throw new NotFoundException('Commercial quote was not found.');
    return this.toQuoteContract(accepted);
  }

  private normalizeInput(
    input: IssueCommercialQuoteInput
  ): NormalizedIssueInput {
    if (!input || !['tier1', 'tier2', 'tier3'].includes(input.tierId)) {
      throw new BadRequestException('tierId must be tier1, tier2, or tier3.');
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('At least one selected offer is required.');
    }
    const items = input.items.map((item) => {
      if (!item || typeof item.offerId !== 'string' || !item.offerId.trim()) {
        throw new BadRequestException('Each item must include an offerId.');
      }
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(
          'Item quantities must be positive integers.'
        );
      }
      return { offerId: item.offerId.trim(), quantity: item.quantity };
    });
    const ids = items.map(({ offerId }) => offerId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Duplicate supplier offer IDs are not allowed.'
      );
    }
    const idempotencyKey =
      typeof input.idempotencyKey === 'string'
        ? input.idempotencyKey.trim()
        : '';
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw new BadRequestException(
        'idempotencyKey must be between 1 and 128 characters.'
      );
    }
    const amounts = {
      monthlyRetainerRevenue: this.validateMoney(
        input.monthlyRetainerRevenue,
        'monthlyRetainerRevenue'
      ),
      monthlyCloudCost: this.validateMoney(
        input.monthlyCloudCost,
        'monthlyCloudCost'
      ),
      monthlySmsCost: this.validateMoney(
        input.monthlySmsCost,
        'monthlySmsCost'
      ),
      monthlyNetworkCost: this.validateMoney(
        input.monthlyNetworkCost,
        'monthlyNetworkCost'
      ),
    };
    return {
      tierId: input.tierId,
      items: items.sort((left, right) =>
        left.offerId.localeCompare(right.offerId)
      ),
      ...amounts,
      idempotencyKey,
    };
  }

  private validateMoney(value: number, name: string): number {
    const cents = this.toCents(value, name);
    if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
      throw new BadRequestException(
        `${name} must be a nonnegative finite amount.`
      );
    }
    return cents / 100;
  }

  private toCents(value: unknown, name: string): number {
    const amount = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException(
        `${name} must be a nonnegative finite amount.`
      );
    }
    const cents = Math.round((amount + Number.EPSILON) * 100);
    if (!Number.isSafeInteger(cents)) {
      throw new BadRequestException(`${name} is too large.`);
    }
    return cents;
  }

  private returnOrRejectRetry(
    quote: CommercialQuoteEntity,
    input: NormalizedIssueInput
  ): CommercialQuote {
    if (
      this.canonicalJson(quote.inputs?.['request']) !==
      this.canonicalJson(input)
    ) {
      throw new ConflictException(
        'This idempotencyKey has already been used with a different quote request.'
      );
    }
    return this.toQuoteContract(quote);
  }

  private toQuoteContract(entity: CommercialQuoteEntity): CommercialQuote {
    return {
      id: entity.id,
      sourceCost: Number(entity.sourceCost),
      currency: entity.currency,
      inputs: entity.inputs,
      terms: entity.terms,
      pricingSnapshot: entity.pricingSnapshot,
      issuedAt: entity.issuedAt,
      validUntil: entity.validUntil,
      version: entity.version,
      state: entity.state as CommercialQuote['state'],
      idempotencyKey: entity.idempotencyKey,
      createdAt: entity.createdAt,
    };
  }

  private canonicalJson(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.canonicalJson(entry)).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
      const sorted = Object.keys(value)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.canonicalJson(
              (value as Record<string, unknown>)[key]
            )}`
        );
      return `{${sorted.join(',')}}`;
    }
    return JSON.stringify(value) ?? 'undefined';
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
