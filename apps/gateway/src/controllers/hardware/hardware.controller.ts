import {
  BadRequestException,
  Body,
  CanActivate,
  ConflictException,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import type { Response } from 'express';
import {
  HardwareCommands,
  LeadCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  ConfigurationDto,
  CreateHardwareOrderDto,
  AcceptCommercialQuoteDto,
  GetCommercialQuoteDto,
  ImportSupplierOffersDto,
  IssueCommercialQuoteDto,
  CommercialQuote,
  CommitHardwareProposalRequest,
  HardwareProposalTier,
  SearchAmazonBusinessOffersDto,
  GenerateClientDeploymentArtifactsDto,
  ClientDeploymentArtifacts,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import validator from 'validator';
import { createClientDeploymentArchive } from './client-deployment-archive';

export class OwnerConsoleScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.headers['x-ot-appscope'] !== 'owner-console') {
      throw new ForbiddenException(
        'This route requires the owner-console app scope.'
      );
    }
    return true;
  }
}

const PRIVATE_TIER_FIELD =
  /(price|pricing|cost|margin|markup|lease.?monthly.?rate|monthly.?lease|contingency|freight|tax|wholesale|procurement|purchase|supplier)/i;

function omitPrivateTierFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(omitPrivateTierFields);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, fieldValue]) =>
      PRIVATE_TIER_FIELD.test(key)
        ? []
        : [[key, omitPrivateTierFields(fieldValue)]]
    )
  );
}

@Controller('hardware')
export class HardwareController {
  constructor(
    @Inject(ServiceTokens.SYSTEM_CONFIGURATOR_SERVICE)
    private readonly systemConfiguratorService: ClientProxy,
    @Inject(ServiceTokens.LEAD_SERVICE)
    private readonly leadService: ClientProxy
  ) {}

  @Get('chassis')
  async getChassis() {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_CHASSIS },
        {}
      )
    );
  }

  @Get('chassis/:id')
  async getChassisById(@Param('id') id: string) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_CHASSIS_BY_ID },
        { id }
      )
    );
  }

  @Get('chassis/:id/compatible')
  async getCompatibleComponents(@Param('id') id: string) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS },
        { chassisId: id }
      )
    );
  }

  @Post('pricing/calculate')
  async calculatePrice(@Body() configuration: ConfigurationDto) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.CALCULATE_PRICE },
        configuration
      )
    );
  }

  @Post('orders')
  async createOrder(@Body() payload: CreateHardwareOrderDto) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.CREATE_ORDER },
        payload
      )
    );
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_ORDER },
        { orderId: id }
      )
    );
  }

  @Get('tiers')
  async getTiers() {
    const tiers = await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_TIERS },
        {}
      )
    );

    return omitPrivateTierFields(tiers);
  }

  @Post('operator/supplier-offers/import')
  @UseGuards(AuthGuard, OwnerConsoleScopeGuard)
  async importSupplierOffers(@Body() payload: ImportSupplierOffersDto) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.IMPORT_SUPPLIER_OFFERS },
        payload
      )
    );
  }

  @Get('operator/supplier-offers')
  @UseGuards(AuthGuard, OwnerConsoleScopeGuard)
  async listSupplierOffers() {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.LIST_SUPPLIER_OFFERS },
        {}
      )
    );
  }

  @Post('operator/supplier-offers/amazon/search')
  @UseGuards(AuthGuard, OwnerConsoleScopeGuard)
  async searchAmazonBusinessOffers(
    @Body() payload: SearchAmazonBusinessOffersDto
  ) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.SEARCH_AMAZON_BUSINESS_OFFERS },
        payload
      )
    );
  }

  @Post('operator/quotes')
  @UseGuards(AuthGuard, OwnerConsoleScopeGuard)
  async issueCommercialQuote(@Body() payload: IssueCommercialQuoteDto) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.ISSUE_COMMERCIAL_QUOTE },
        payload
      )
    );
  }

  @Get('operator/quotes/:id')
  @UseGuards(AuthGuard, OwnerConsoleScopeGuard)
  async getCommercialQuote(@Param('id') id: string) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_COMMERCIAL_QUOTE },
        { quoteId: id } satisfies GetCommercialQuoteDto
      )
    );
  }

  @Post('operator/quotes/:id/accept')
  @UseGuards(AuthGuard, OwnerConsoleScopeGuard)
  async acceptCommercialQuote(@Param('id') id: string) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.ACCEPT_COMMERCIAL_QUOTE },
        { quoteId: id } satisfies AcceptCommercialQuoteDto
      )
    );
  }

  @Post('operator/quotes/:id/deployment-artifacts')
  @UseGuards(AuthGuard, OwnerConsoleScopeGuard)
  async generateClientDeploymentArtifacts(
    @Param('id') quoteId: string,
    @Body()
    body: Omit<GenerateClientDeploymentArtifactsDto, 'quoteId'>,
    @Res() response: Response
  ) {
    const payload: GenerateClientDeploymentArtifactsDto = {
      quoteId,
      organization: body.organization,
      contactName: body.contactName,
      imageTag: body.imageTag,
      gatewayUrl: body.gatewayUrl,
      gatewayWsUrl: body.gatewayWsUrl,
      socketUrl: body.socketUrl,
    };
    const artifacts = (await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GENERATE_CLIENT_DEPLOYMENT_ARTIFACTS },
        payload
      )
    )) as ClientDeploymentArtifacts;
    const archive = createClientDeploymentArchive(artifacts);
    const safeQuoteId = quoteId.replace(/[^a-zA-Z0-9-]/g, '') || 'quote';

    response.setHeader('Content-Type', 'application/gzip');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="hai-computer-${safeQuoteId}.tar.gz"`
    );
    response.setHeader('Cache-Control', 'no-store, private');
    response.setHeader('Content-Length', String(archive.length));
    return response.send(archive);
  }

  @Post('operator/quotes/:id/commit')
  @UseGuards(AuthGuard, OwnerConsoleScopeGuard)
  async commitHardwareProposal(
    @Param('id') id: string,
    @Body()
    customer: {
      customerName?: unknown;
      customerEmail?: unknown;
      customerPhone?: unknown;
    },
    @Req()
    request: {
      headers?: Record<string, string | string[] | undefined>;
      user?: { userId?: string; profileId?: string };
    }
  ) {
    if (request?.headers?.['x-ot-appscope'] !== 'owner-console') {
      throw new ForbiddenException(
        'This route requires the owner-console app scope.'
      );
    }

    const userId = request?.user?.userId?.trim();
    const profileId = request?.user?.profileId?.trim();
    if (!userId || !profileId) {
      throw new ForbiddenException(
        'A verified owner user and profile are required.'
      );
    }
    if (
      typeof customer?.customerName !== 'string' ||
      !customer.customerName.trim() ||
      customer.customerName.trim().length > 255 ||
      /\p{Cc}/u.test(customer.customerName)
    ) {
      throw new BadRequestException(
        'Customer name is required to commit a hardware proposal.'
      );
    }

    const customerEmail =
      typeof customer.customerEmail === 'string'
        ? customer.customerEmail.trim()
        : '';
    if (
      customerEmail &&
      (customerEmail.length > 254 ||
        /\p{Cc}/u.test(customerEmail) ||
        !validator.isEmail(customerEmail))
    ) {
      throw new BadRequestException(
        'A valid customer email is required when an email is provided.'
      );
    }

    const customerPhone =
      typeof customer.customerPhone === 'string'
        ? customer.customerPhone.trim()
        : '';
    if (customerPhone.length > 50 || /\p{Cc}/u.test(customerPhone)) {
      throw new BadRequestException(
        'Customer phone must be 50 characters or fewer.'
      );
    }

    const quote = (await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_COMMERCIAL_QUOTE },
        { quoteId: id } satisfies GetCommercialQuoteDto
      )
    )) as CommercialQuote;

    if (!quote || quote.id !== id) {
      throw new ConflictException('The requested quote could not be verified.');
    }
    if (quote?.state !== 'accepted') {
      throw new ConflictException(
        'Only an accepted commercial quote can be committed as a customer proposal.'
      );
    }
    const validUntilMs = new Date(quote.validUntil).getTime();
    if (!Number.isFinite(validUntilMs) || validUntilMs <= Date.now()) {
      throw new ConflictException(
        'The accepted commercial quote has expired and cannot be committed.'
      );
    }

    const tier = quote.terms?.tierId;
    const snapshot = quote.pricingSnapshot as
      | Record<string, unknown>
      | undefined;
    const outrightPrice = snapshot?.['outrightPrice'];
    const requestSnapshot = quote.inputs?.['request'] as
      | Record<string, unknown>
      | undefined;
    const monthlyRetainerRevenue = requestSnapshot?.['monthlyRetainerRevenue'];
    if (
      !['tier1', 'tier2', 'tier3'].includes(String(tier)) ||
      typeof outrightPrice !== 'number' ||
      !Number.isFinite(outrightPrice) ||
      outrightPrice < 0 ||
      !/^[A-Z]{3}$/.test(quote.currency || '')
    ) {
      throw new BadRequestException(
        'The accepted quote is missing a valid customer price snapshot.'
      );
    }

    const customerTerms: Record<string, unknown> = {
      tierId: tier,
      quoteVersion: quote.version,
      issuedAt: quote.terms?.issuedAt,
      validUntil:
        quote.terms?.validUntil ?? new Date(validUntilMs).toISOString(),
      hardwarePrice: outrightPrice,
    };
    if (
      typeof monthlyRetainerRevenue === 'number' &&
      Number.isFinite(monthlyRetainerRevenue) &&
      monthlyRetainerRevenue >= 0
    ) {
      customerTerms['monthlyRetainerRevenue'] = monthlyRetainerRevenue;
    }

    const payload: CommitHardwareProposalRequest = {
      context: {
        userId,
        profileId,
        appScope: 'owner-console',
        ownerConsoleAccess: true,
      },
      proposal: {
        quoteId: quote.id,
        customerName: customer.customerName.trim(),
        ...(customerEmail ? { customerEmail } : {}),
        ...(customerPhone ? { customerPhone } : {}),
        tier: tier as HardwareProposalTier,
        total: outrightPrice,
        currency: quote.currency,
        terms: customerTerms,
        idempotencyKey: `hardware-proposal-quote:${quote.id}`,
      },
    };

    return await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.COMMIT_HARDWARE_PROPOSAL },
        payload
      )
    );
  }

  @Get('operator/access')
  @UseGuards(AuthGuard, OwnerConsoleScopeGuard)
  async probeOperatorAccess() {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.PROBE_OPERATOR_ACCESS },
        {}
      )
    );
  }
}
