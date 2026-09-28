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

type QuoteLease = {
  termMonths?: unknown;
  monthlyTotal?: unknown;
  monthlyMaintenanceReserve?: unknown;
};

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
    const leases = Array.isArray(pricing['leases'])
      ? (pricing['leases'] as QuoteLease[])
      : [];
    const lease24 = leases.find((lease) => lease?.termMonths === 24);
    const lease36 = leases.find((lease) => lease?.termMonths === 36);
    if (!lease24 || !lease36 || typeof terms['tierId'] !== 'string') {
      throw new BadRequestException(
        'Accepted quote is missing its appliance tier or lease snapshots.'
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
          upfrontTotalCents: amountCents(
            pricing['outrightPrice'],
            'outright price'
          ),
          lease24MonthlyCents: amountCents(
            lease24.monthlyTotal,
            '24-month lease'
          ),
          lease36MonthlyCents: amountCents(
            lease36.monthlyTotal,
            '36-month lease'
          ),
          maintenanceMonthlyCents: amountCents(
            lease24.monthlyMaintenanceReserve,
            'monthly maintenance reserve'
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
