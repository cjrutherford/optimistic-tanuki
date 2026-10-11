import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import type {
  ClientDeploymentArtifacts,
  CommercialQuote,
  GenerateClientDeploymentArtifactsDto,
} from '@optimistic-tanuki/models';
import { compileClientDeploymentArtifacts } from '../hardware/client-deployment-artifacts';
import { CommercialQuoteService } from './commercial-quote.service';

type Clock = () => Date;
export const CLIENT_DEPLOYMENT_ARTIFACT_CLOCK = Symbol(
  'CLIENT_DEPLOYMENT_ARTIFACT_CLOCK'
);

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(
      `Accepted quote is missing its ${label} snapshot.`
    );
  }
  return value as Record<string, unknown>;
}

function amountCents(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new BadRequestException(
      `Accepted quote has an invalid ${label} snapshot.`
    );
  }
  const cents = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new BadRequestException(
      `Accepted quote has an invalid ${label} snapshot.`
    );
  }
  return cents;
}

function hoursValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new BadRequestException(
      `Accepted quote has an invalid ${label} snapshot.`
    );
  }
  return value;
}

@Injectable()
export class ClientDeploymentArtifactService {
  constructor(
    private readonly commercialQuoteService: CommercialQuoteService,
    @Optional()
    @Inject(CLIENT_DEPLOYMENT_ARTIFACT_CLOCK)
    private readonly clock: Clock = () => new Date()
  ) {}

  async generate(
    request: GenerateClientDeploymentArtifactsDto
  ): Promise<ClientDeploymentArtifacts> {
    const quote: CommercialQuote = await this.commercialQuoteService.getQuote(
      request.quoteId
    );
    if (quote.state !== 'accepted') {
      throw new ConflictException(
        'Only an accepted commercial quote can generate deployment artifacts.'
      );
    }

    const now = this.clock();
    const validUntil = new Date(quote.validUntil);
    if (
      !(now instanceof Date) ||
      !Number.isFinite(now.getTime()) ||
      !Number.isFinite(validUntil.getTime()) ||
      validUntil.getTime() <= now.getTime()
    ) {
      throw new ConflictException(
        'The accepted commercial quote has expired and cannot generate deployment artifacts.'
      );
    }

    const pricing = asRecord(quote.pricingSnapshot, 'pricing');
    const terms = asRecord(quote.terms, 'commercial terms');
    const monthlySupport = asRecord(
      pricing['monthlySupport'],
      'monthly support'
    );
    if (
      pricing['pricingModel'] !== 'pass-through' ||
      typeof terms['tierId'] !== 'string'
    ) {
      throw new BadRequestException(
        'Accepted quote is missing its appliance tier or pass-through pricing snapshot.'
      );
    }

    const issuedAt = new Date(quote.issuedAt);
    if (!Number.isFinite(issuedAt.getTime())) {
      throw new BadRequestException(
        'Accepted quote has an invalid issue timestamp.'
      );
    }

    try {
      return compileClientDeploymentArtifacts({
        acceptedQuote: {
          quoteId: quote.id,
          issuedAt: issuedAt.toISOString(),
          expiresAt: validUntil.toISOString(),
          applianceTier: terms['tierId'],
          currency: quote.currency,
          hardwareCents: amountCents(pricing['hardwareCost'], 'hardware cost'),
          freightCents: amountCents(pricing['freightAmount'], 'freight'),
          taxCents: amountCents(pricing['taxAmount'], 'tax'),
          setupHours: hoursValue(pricing['setupHours'], 'setup hours'),
          setupLaborCents: amountCents(pricing['setupLabor'], 'setup labor'),
          upfrontTotalCents: amountCents(
            pricing['outrightPrice'],
            'up-front total'
          ),
          laborRateCents: amountCents(
            pricing['laborRatePerHour'],
            'labor rate'
          ),
          monthlySupportHours: hoursValue(
            monthlySupport['supportHours'],
            'monthly support hours'
          ),
          monthlySupportLaborCents: amountCents(
            monthlySupport['supportLabor'],
            'monthly support labor'
          ),
          monthlyPassThroughCents: amountCents(
            monthlySupport['passThroughCosts'],
            'monthly service costs'
          ),
          monthlySupportTotalCents: amountCents(
            monthlySupport['monthlyTotal'],
            'monthly support total'
          ),
        },
        customer: {
          organization: request.organization,
          contactName: request.contactName,
        },
        deployment: {
          imageTag: request.imageTag,
          gatewayUrl: request.gatewayUrl,
          gatewayWsUrl: request.gatewayWsUrl,
          socketUrl: request.socketUrl,
          applicationBundle: 'bto-appliance',
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Deployment artifact settings are invalid.'
      );
    }
  }
}
