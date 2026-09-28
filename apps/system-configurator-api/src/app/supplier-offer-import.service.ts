import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import type {
  CreateSupplierOfferDto,
  SupplierOfferSummary,
  SupplierVendor,
} from '@optimistic-tanuki/models';
import {
  parseDistributorFeed,
  type NormalizedDistributorOffer,
} from '../hardware/distributor-feed.parser';
import { SupplierOfferEntity } from '../hardware/entities/supplier-offer.entity';

export type SupplierOfferFeedFormat = 'csv' | 'json';
export const MAX_SUPPLIER_FEED_BYTES = 1_048_576;

export interface ImportSupplierOffersInput {
  provider: SupplierVendor;
  content: string;
  format: SupplierOfferFeedFormat;
}

export interface SupplierOfferImportResult {
  inserted: number;
  updated: number;
  skipped: number;
}

@Injectable()
export class SupplierOfferImportService {
  constructor(
    @InjectRepository(SupplierOfferEntity)
    private readonly offerRepository: Repository<SupplierOfferEntity>
  ) {}

  async listRecentOffers(): Promise<SupplierOfferSummary[]> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const offers = await this.offerRepository.find({
      where: { observedAt: MoreThan(cutoff) },
      order: { observedAt: 'DESC', vendor: 'ASC', sourceSku: 'ASC' },
      take: 500,
    });
    return offers.map((offer) => ({
      id: offer.id,
      vendor: offer.vendor as SupplierVendor,
      sourceChannel: offer.sourceChannel,
      sourceSku: offer.sourceSku,
      productName: offer.productName,
      sourceUrl: offer.sourceUrl,
      amount: Number(offer.amount),
      currency: offer.currency,
      availability: offer.availability as SupplierOfferSummary['availability'],
      observedAt: offer.observedAt,
    }));
  }

  async import(
    input: ImportSupplierOffersInput
  ): Promise<SupplierOfferImportResult> {
    if (Buffer.byteLength(input.content, 'utf8') > MAX_SUPPLIER_FEED_BYTES) {
      throw new BadRequestException(
        'Supplier offer feed exceeds the 1 MiB size limit.'
      );
    }
    assertFormat(input.content, input.format);
    const offers = parseDistributorFeed(input.content);

    if (offers.some((offer) => offer.vendor !== input.provider)) {
      throw new BadRequestException(
        'Feed provider must match the selected provider'
      );
    }

    return this.upsertOffers(offers, 'file-import');
  }

  /**
   * Store only offers returned by an authenticated vendor adapter. This is an
   * internal service entry point; no TCP handler accepts a caller-supplied
   * `sourceChannel` value.
   */
  async recordLiveApiOffers(
    provider: SupplierVendor,
    offers: Array<
      Omit<CreateSupplierOfferDto, 'observedAt'> & { observedAt: Date }
    >
  ): Promise<SupplierOfferImportResult> {
    if (!Array.isArray(offers) || offers.length === 0 || offers.length > 500) {
      throw new BadRequestException(
        'A live API result must contain between 1 and 500 offers.'
      );
    }
    const normalized = offers.map((offer) =>
      this.validateLiveOffer(provider, offer)
    );
    return this.upsertOffers(normalized, 'live-api');
  }

  private async upsertOffers(
    offers: NormalizedDistributorOffer[],
    sourceChannel: SupplierOfferEntity['sourceChannel']
  ): Promise<SupplierOfferImportResult> {
    // Validate every row before opening a transaction, so an invalid import
    // can never leave partial rows behind.
    return this.offerRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(SupplierOfferEntity);
      const result: SupplierOfferImportResult = {
        inserted: 0,
        updated: 0,
        skipped: 0,
      };

      for (const offer of offers) {
        const current = await repository.findOne({
          where: { vendor: offer.vendor, sourceId: offer.sourceId },
          lock: { mode: 'pessimistic_write' },
        });

        if (
          current &&
          current.observedAt.getTime() >= offer.observedAt.getTime()
        ) {
          result.skipped += 1;
          continue;
        }

        const values = {
          vendor: offer.vendor,
          sourceChannel,
          sourceId: offer.sourceId,
          sourceSku: offer.sourceSku,
          productName: offer.productName,
          sourceUrl: offer.sourceUrl ?? null,
          hardwarePartId: offer.hardwarePartId ?? null,
          amount: offer.amount,
          currency: offer.currency,
          availability: offer.availability,
          observedAt: offer.observedAt,
        };

        if (current) {
          // Keep the stored source identity stable while replacing only the
          // observation fields with a strictly newer vendor observation.
          await repository.save({ ...current, ...values, id: current.id });
          result.updated += 1;
        } else {
          await repository.save(repository.create(values));
          result.inserted += 1;
        }
      }

      return result;
    });
  }

  private validateLiveOffer(
    provider: SupplierVendor,
    offer: Omit<CreateSupplierOfferDto, 'observedAt'> & { observedAt: Date }
  ): NormalizedDistributorOffer {
    if (!offer || offer.vendor !== provider) {
      throw new BadRequestException(
        'Live API offer vendor must match the selected provider.'
      );
    }
    const observedAt =
      offer.observedAt instanceof Date
        ? new Date(offer.observedAt)
        : new Date(Number.NaN);
    if (
      !Number.isFinite(observedAt.getTime()) ||
      observedAt.getTime() > Date.now()
    ) {
      throw new BadRequestException(
        'Live API offer observation time must be valid and not in the future.'
      );
    }
    if (
      !nonEmptyText(offer.sourceId, 255) ||
      !nonEmptyText(offer.sourceSku, 255) ||
      !nonEmptyText(offer.productName, 512) ||
      typeof offer.amount !== 'number' ||
      !Number.isFinite(offer.amount) ||
      offer.amount < 0 ||
      Math.round(offer.amount * 100) !== offer.amount * 100 ||
      typeof offer.currency !== 'string' ||
      !/^[A-Za-z]{3}$/.test(offer.currency) ||
      !['in_stock', 'backorder', 'out_of_stock', 'unknown'].includes(
        offer.availability
      ) ||
      (offer.sourceUrl != null && !validHttpUrl(offer.sourceUrl)) ||
      (offer.hardwarePartId != null && typeof offer.hardwarePartId !== 'string')
    ) {
      throw new BadRequestException(
        'Live API returned an invalid supplier offer.'
      );
    }
    return {
      ...offer,
      vendor: provider,
      currency: offer.currency.toUpperCase(),
      observedAt,
      availability: offer.availability,
      sourceUrl: offer.sourceUrl ?? null,
      hardwarePartId: offer.hardwarePartId ?? null,
    };
  }
}

function nonEmptyText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function validHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function assertFormat(content: string, format: SupplierOfferFeedFormat): void {
  const startsAsJson = content.trimStart().startsWith('[');
  if ((format === 'json') !== startsAsJson) {
    throw new BadRequestException(
      `Feed content does not match the selected ${format.toUpperCase()} format`
    );
  }
}
