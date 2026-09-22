import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Patch,
  Query,
  RawBodyRequest,
  Req,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, defaultIfEmpty } from 'rxjs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentCommands } from '@optimistic-tanuki/constants';
import { BusinessContentCommands } from '@optimistic-tanuki/social-contracts';
import { RecordDonationDto } from '@optimistic-tanuki/payments-contracts';
import { DisabledClientProxy } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import { ConfigService } from '@nestjs/config';
import { TcpServiceConfig } from '../../config';
import { verifyWebhookSignature } from './payments-webhook';

export interface CreateDonationDto {
  amount: number;
  isRecurring: boolean;
}

export interface CreateClassifiedPaymentDto {
  classifiedId: string;
  paymentMethod: 'card' | 'cash-app' | 'venmo' | 'zelle' | 'cash';
  sellerId?: string;
  amount?: number;
}

export interface ConfirmOutOfPlatformDto {
  proofImageUrl?: string;
}

export interface CreateBusinessPageDto {
  communityId: string;
  tier: 'basic' | 'pro' | 'enterprise';
}

export interface UpdateBusinessPageDto {
  name?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  pinnedPostId?: string;
}

export interface CreateSponsorshipDto {
  communityId: string;
  type: 'sticky-ad' | 'banner' | 'featured';
  adContent?: string;
}

export interface CreateOfferDto {
  classifiedId: string;
  sellerId: string;
  amount: number;
  message?: string;
}

export interface CounterOfferDto {
  counterAmount: number;
  message?: string;
}

export interface UpdatePayoutInfoDto {
  payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle';
  payoutEmail?: string;
  bankAccountLast4?: string;
  bankRoutingLast4?: string;
}

export interface CreatePayoutRequestDto {
  amount: number;
  payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle';
  payoutEmail?: string;
  bankAccountLast4?: string;
  bankRoutingLast4?: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly paymentsClient: ReturnType<typeof ClientProxyFactory.create>;
  private readonly socialClient: ReturnType<typeof ClientProxyFactory.create>;
  private readonly logger = new Logger(PaymentsController.name);

  /**
   * O13 fan-out helper: list endpoints must tolerate single-object and empty
   * service returns (pinned by existing handler specs) — normalize first,
   * then overlay social content by back-reference.
   */
  private overlayContent(
    rows: unknown,
    contents: unknown
  ): Array<Record<string, unknown>> {
    const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
    const contentList = (Array.isArray(contents) ? contents : []) as Array<
      Record<string, unknown>
    >;
    const byPaymentsId = new Map(
      contentList.map((content) => [
        content['paymentsBusinessPageId'] ?? content['paymentsSponsorshipId'],
        content,
      ])
    );
    return (list as Array<Record<string, unknown>>).map((row) => {
      const content = byPaymentsId.get(row['id']);
      if (!content) {
        return row;
      }
      const { id: _contentId, ...contentFields } = content;
      return { ...row, ...contentFields };
    });
  }

  private resolveMonthYear(month?: string, year?: string) {
    const now = new Date();
    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    const targetMonth =
      Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : now.getMonth() + 1;
    const targetYear =
      Number.isInteger(parsedYear) && parsedYear >= 1970 && parsedYear <= 3000
        ? parsedYear
        : now.getFullYear();

    return { targetMonth, targetYear };
  }

  constructor(private readonly configService: ConfigService) {
    const serviceConfig =
      this.configService.get<TcpServiceConfig>('services.payments');
    this.paymentsClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: serviceConfig.host,
        port: serviceConfig.port,
      },
    });
    // O13 fan-out reads social content via the same ad-hoc pattern as the
    // payments client above (this controller predates provider tokens;
    // converting both is follow-up work). Social misses fall back to
    // payments-only rows so pre-dual-write data keeps serving. A missing
    // social config degrades to a disabled proxy instead of crashing
    // construction (existing specs only mock the payments config).
    const socialConfig =
      this.configService.get<TcpServiceConfig>('services.social');
    this.socialClient = socialConfig
      ? ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: socialConfig.host,
            port: socialConfig.port,
          },
        })
      : new DisabledClientProxy('social');
  }

  private async sendOfferCommand<T>(
    pattern: { cmd: string },
    payload: unknown,
    notFoundMessage?: string
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.paymentsClient.send<T>(pattern, payload)
      );
    } catch (error) {
      const statusCode =
        typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : undefined;
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: unknown }).message
          : undefined;
      const normalizedMessage =
        typeof message === 'string' ? message : 'Offer request failed';

      if (statusCode === 400) {
        throw new BadRequestException(normalizedMessage);
      }
      if (statusCode === 404) {
        throw new NotFoundException(notFoundMessage ?? normalizedMessage);
      }
      throw error;
    }
  }

  private async sendPaymentRead<T>(
    pattern: { cmd: string },
    payload: unknown
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.paymentsClient.send<T>(pattern, payload)
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        Number((error as { statusCode?: unknown }).statusCode) === 404
      ) {
        throw new NotFoundException('Payment not found');
      }
      throw error;
    }
  }

  @Get('donations/goal')
  @Public()
  @ApiOperation({ summary: 'Get monthly donation goal progress' })
  @ApiResponse({ status: 200, description: 'Donation goal info' })
  async getDonationGoal(
    @Query('month') month?: string,
    @Query('year') year?: string
  ) {
    const { targetMonth, targetYear } = this.resolveMonthYear(month, year);

    try {
      return await firstValueFrom(
        this.paymentsClient.send(
          { cmd: PaymentCommands.GET_DONATION_GOAL },
          {
            month: targetMonth,
            year: targetYear,
          }
        )
      );
    } catch (error) {
      this.logger.error('Failed to get donation goal:', error);
      return {
        monthlyGoal: 5000,
        currentAmount: 0,
        donorCount: 0,
        month: targetMonth,
        year: targetYear,
      };
    }
  }

  @Get('donations')
  @Public()
  @ApiOperation({ summary: 'Get donations for a month' })
  async getDonations(
    @Query('month') month?: string,
    @Query('year') year?: string
  ) {
    const { targetMonth, targetYear } = this.resolveMonthYear(month, year);

    try {
      return await firstValueFrom(
        this.paymentsClient.send(
          { cmd: PaymentCommands.LIST_DONATIONS },
          {
            month: targetMonth,
            year: targetYear,
          }
        )
      );
    } catch (error) {
      this.logger.error('Failed to get donations:', error);
      return [];
    }
  }

  // O14 cutover target for store-client donations (decided): direct record
  // preserving anonymous gifts (no identity required). Distinct from
  // checkout, which mints a provider session for identified donors.
  @Post('donations')
  @Public()
  @ApiOperation({ summary: 'Record a donation directly' })
  async recordDonation(@Body() dto: RecordDonationDto) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.RECORD_DONATION },
        {
          userId: dto.userId,
          profileId: dto.profileId,
          amount: dto.amount,
          currency: dto.currency ?? 'USD',
          isRecurring: dto.isRecurring ?? false,
          message: dto.message,
          anonymous: dto.anonymous ?? !dto.userId,
        }
      )
    );
  }

  @Post('donations/checkout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create donation checkout session' })
  async createDonationCheckout(
    @User() user: UserDetails,
    @Body() dto: CreateDonationDto,
    @AppScope() appScope: string
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_DONATION_CHECKOUT },
        {
          userId: user.userId,
          profileId: user.profileId,
          amount: dto.amount,
          isRecurring: dto.isRecurring,
          appScope,
        }
      )
    );
  }

  @Get('donations/user')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user donations' })
  async getUserDonations(@User() user: UserDetails) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_USER_DONATIONS },
        {
          userId: user.userId,
        }
      )
    );
  }

  @Delete('donations/subscription/:subscriptionId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel recurring donation' })
  async cancelRecurringDonation(
    @User() user: UserDetails,
    @Param('subscriptionId') subscriptionId: string
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CANCEL_SUBSCRIPTION },
        {
          userId: user.userId,
          subscriptionId,
        }
      )
    );
  }

  @Post('classifieds/payment')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment for classified' })
  async createClassifiedPayment(
    @User() user: UserDetails,
    @Body() dto: CreateClassifiedPaymentDto,
    @AppScope() appScope: string
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_CLASSIFIED_PAYMENT },
        {
          buyerId: user.userId,
          profileId: user.profileId,
          classifiedId: dto.classifiedId,
          paymentMethod: dto.paymentMethod,
          sellerId: dto.sellerId,
          amount: dto.amount,
          appScope,
        }
      )
    );
  }

  @Post('classifieds/payment/:paymentId/confirm')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm out-of-platform payment' })
  async confirmOutOfPlatformPayment(
    @User() user: UserDetails,
    @Param('paymentId') paymentId: string,
    @Body() dto: ConfirmOutOfPlatformDto
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CONFIRM_OUT_OF_PLATFORM_PAYMENT },
        {
          paymentId,
          userId: user.userId,
          proofImageUrl: dto.proofImageUrl,
        }
      )
    );
  }

  @Post('classifieds/payment/:paymentId/release')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm payment received and release funds' })
  async confirmPaymentReceived(
    @User() user: UserDetails,
    @Param('paymentId') paymentId: string
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.RELEASE_FUNDS },
        {
          paymentId,
          userId: user.userId,
        }
      )
    );
  }

  @Post('classifieds/payment/:paymentId/dispute')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispute a payment' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      required: ['reason'],
    },
  })
  async disputePayment(
    @User() user: UserDetails,
    @Param('paymentId') paymentId: string,
    @Body() body: { reason: string }
  ) {
    const reason = body?.reason;
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.DISPUTE_PAYMENT },
        {
          paymentId,
          userId: user.userId,
          reason,
        }
      )
    );
  }

  @Get('classifieds/payment/:paymentId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment details' })
  async getPayment(
    @User() user: UserDetails,
    @Param('paymentId') paymentId: string
  ) {
    return this.sendPaymentRead(
      { cmd: PaymentCommands.GET_PAYMENT },
      { paymentId, userId: user.userId }
    );
  }

  @Get('classifieds/payments/user')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user payments' })
  async getUserPayments(@User() user: UserDetails) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_USER_PAYMENTS },
        {
          userId: user.userId,
        }
      )
    );
  }

  @Post('business/checkout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create business page subscription checkout' })
  async createBusinessCheckout(
    @User() user: UserDetails,
    @Body() dto: CreateBusinessPageDto,
    @AppScope() appScope: string
  ) {
    // O13 dual-write (decided): payments row first, then the social content
    // mirror with the back-reference. A social failure degrades to
    // payments-only reads (the fan-out fallback) rather than failing checkout.
    const result = (await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_BUSINESS_CHECKOUT },
        {
          userId: user.userId,
          communityId: dto.communityId,
          tier: dto.tier,
          appScope,
        }
      )
    )) as { checkoutUrl: string; businessPageId: string };
    try {
      await firstValueFrom(
        this.socialClient.send(
          { cmd: BusinessContentCommands.PAGE_CREATE },
          {
            communityId: dto.communityId,
            ownerId: user.userId,
            tier: dto.tier,
            paymentsBusinessPageId: result.businessPageId,
          }
        )
      );
    } catch (error) {
      this.logger.warn(
        `Social business-page mirror failed for community ${dto.communityId}: ${
          (error as Error)?.message ?? error
        }`
      );
    }
    return result;
  }

  @Get('business/:communityId')
  @Public()
  @ApiOperation({ summary: 'Get business page for community' })
  async getBusinessPage(@Param('communityId') communityId: string) {
    // O13 fan-out (decided): social content overlaid on the payments money
    // row; payments-only when no social row exists yet (pre-dual-write).
    const [content, page] = await Promise.all([
      firstValueFrom(
        this.socialClient.send(
          { cmd: BusinessContentCommands.PAGE_GET },
          { communityId }
        )
      ).catch(() => null),
      firstValueFrom(
        this.paymentsClient
          .send(
            { cmd: PaymentCommands.GET_BUSINESS_PAGE },
            {
              communityId,
            }
          )
          .pipe(defaultIfEmpty(null))
      ),
    ]);
    if (!content) {
      return page;
    }
    if (!page) {
      return content;
    }
    const { id: _contentId, ...contentFields } = content as Record<
      string,
      unknown
    >;
    return { ...(page as Record<string, unknown>), ...contentFields };
  }

  @Get('business/city/:cityId')
  @Public()
  @ApiOperation({ summary: 'Get business pages for all communities in a city' })
  async getBusinessPagesByCity(
    @Param('cityId') cityId: string,
    @Query('communityIds') communityIds?: string
  ) {
    const ids = communityIds ? communityIds.split(',') : [];
    const [pages, contents] = await Promise.all([
      firstValueFrom(
        this.paymentsClient.send(
          { cmd: PaymentCommands.GET_BUSINESS_PAGES_BY_CITY },
          {
            cityId,
            communityIds: ids,
          }
        )
      ) as Promise<Array<Record<string, unknown>>>,
      ids.length > 0
        ? firstValueFrom(
            this.socialClient.send(
              { cmd: BusinessContentCommands.PAGES_BY_COMMUNITIES },
              { communityIds: ids }
            )
          ).catch(() => [])
        : Promise.resolve([]),
    ]);
    // O13 fan-out: overlay social content where a row references the payments
    // row id; unmatched payments rows pass through unchanged.
    return this.overlayContent(pages, contents);
  }

  @Patch('business/:communityId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update business page' })
  async updateBusinessPage(
    @User() user: UserDetails,
    @Param('communityId') communityId: string,
    @Body() dto: UpdateBusinessPageDto
  ) {
    // O13 dual-write (decided): payments first (owner-scoped, authoritative),
    // then the social mirror best-effort. A missing social row is not an
    // error (pre-dual-write pages have none until O14 backfill).
    const result = await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.UPDATE_BUSINESS_PAGE },
        {
          userId: user.userId,
          communityId,
          ...dto,
        }
      )
    );
    try {
      await firstValueFrom(
        this.socialClient.send(
          { cmd: BusinessContentCommands.PAGE_UPDATE },
          {
            communityId,
            ownerId: user.userId,
            data: { ...(dto as Record<string, unknown>) },
          }
        )
      );
    } catch (error) {
      this.logger.warn(
        `Social business-page mirror update failed for community ${communityId}: ${
          (error as Error)?.message ?? error
        }`
      );
    }
    return result;
  }

  @Delete('business/:communityId/subscription')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel business subscription' })
  async cancelBusinessSubscription(
    @User() user: UserDetails,
    @Param('communityId') communityId: string
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CANCEL_BUSINESS_SUBSCRIPTION },
        {
          userId: user.userId,
          communityId,
        }
      )
    );
  }

  @Post('sponsorship/checkout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create community sponsorship checkout' })
  async createSponsorshipCheckout(
    @User() user: UserDetails,
    @Body() dto: CreateSponsorshipDto,
    @AppScope() appScope: string
  ) {
    // O13 dual-write (decided): payments row first, then the social content
    // mirror with the back-reference. Best-effort on the mirror (warn, don't
    // fail checkout) — fan-out falls back to payments-only rows.
    const result = (await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_SPONSORSHIP_CHECKOUT },
        {
          userId: user.userId,
          communityId: dto.communityId,
          type: dto.type,
          adContent: dto.adContent,
          appScope,
        }
      )
    )) as { checkoutUrl: string; sponsorshipId: string };
    try {
      await firstValueFrom(
        this.socialClient.send(
          { cmd: BusinessContentCommands.SPONSORSHIP_CREATE },
          {
            communityId: dto.communityId,
            userId: user.userId,
            type: dto.type,
            adContent: dto.adContent,
            paymentsSponsorshipId: result.sponsorshipId,
          }
        )
      );
    } catch (error) {
      this.logger.warn(
        `Social sponsorship mirror failed for community ${dto.communityId}: ${
          (error as Error)?.message ?? error
        }`
      );
    }
    return result;
  }

  @Get('sponsorship/:communityId/active')
  @Public()
  @ApiOperation({ summary: 'Get active sponsorships for community' })
  async getActiveSponsorships(@Param('communityId') communityId: string) {
    // O13 fan-out (decided): overlay social content where a row references
    // the payments row id; unmatched payments rows pass through unchanged.
    const [sponsorships, contents] = await Promise.all([
      firstValueFrom(
        this.paymentsClient.send(
          { cmd: PaymentCommands.GET_ACTIVE_SPONSORSHIPS },
          {
            communityId,
          }
        )
      ) as Promise<Array<Record<string, unknown>>>,
      firstValueFrom(
        this.socialClient.send(
          { cmd: BusinessContentCommands.SPONSORSHIP_ACTIVE },
          { communityId }
        )
      ).catch(() => []),
    ]);
    return this.overlayContent(sponsorships, contents);
  }

  @Get('sponsorship/user')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user sponsorships' })
  async getUserSponsorships(@User() user: UserDetails) {
    // O13 fan-out (decided): same overlay rule as getActiveSponsorships.
    const [sponsorships, contents] = await Promise.all([
      firstValueFrom(
        this.paymentsClient.send(
          { cmd: PaymentCommands.GET_USER_SPONSORSHIPS },
          {
            userId: user.userId,
          }
        )
      ) as Promise<Array<Record<string, unknown>>>,
      firstValueFrom(
        this.socialClient.send(
          { cmd: BusinessContentCommands.SPONSORSHIP_USER },
          { userId: user.userId }
        )
      ).catch(() => []),
    ]);
    return this.overlayContent(sponsorships, contents);
  }

  @Get('transactions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user transactions' })
  async getTransactions(@User() user: UserDetails) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_USER_TRANSACTIONS },
        {
          userId: user.userId,
        }
      )
    );
  }

  @Get('portal')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Lemon Squeezy customer portal URL' })
  async getPortal(@User() user: UserDetails) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_PORTAL_URL },
        {
          userId: user.userId,
        }
      )
    );
  }

  @Post('offers')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an offer on a classified' })
  async createOffer(@User() user: UserDetails, @Body() dto: CreateOfferDto) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_OFFER },
        {
          buyerId: user.userId,
          classifiedId: dto.classifiedId,
          sellerId: dto.sellerId,
          amount: dto.amount,
          message: dto.message,
        }
      )
    );
  }

  @Patch('offers/:offerId/accept')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept an offer' })
  async acceptOffer(
    @User() user: UserDetails,
    @Param('offerId') offerId: string
  ) {
    return this.sendOfferCommand(
      { cmd: PaymentCommands.ACCEPT_OFFER },
      { offerId, sellerId: user.userId }
    );
  }

  @Patch('offers/:offerId/reject')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject an offer' })
  async rejectOffer(
    @User() user: UserDetails,
    @Param('offerId') offerId: string
  ) {
    return this.sendOfferCommand(
      { cmd: PaymentCommands.REJECT_OFFER },
      { offerId, sellerId: user.userId }
    );
  }

  @Patch('offers/:offerId/counter')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Counter an offer' })
  async counterOffer(
    @User() user: UserDetails,
    @Param('offerId') offerId: string,
    @Body() dto: CounterOfferDto
  ) {
    return this.sendOfferCommand(
      { cmd: PaymentCommands.COUNTER_OFFER },
      {
        offerId,
        sellerId: user.userId,
        counterAmount: dto.counterAmount,
        message: dto.message,
      }
    );
  }

  @Patch('offers/:offerId/withdraw')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Withdraw an offer' })
  async withdrawOffer(
    @User() user: UserDetails,
    @Param('offerId') offerId: string
  ) {
    return this.sendOfferCommand(
      { cmd: PaymentCommands.WITHDRAW_OFFER },
      { offerId, buyerId: user.userId }
    );
  }

  @Get('offers/classified/:classifiedId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get offers for a classified' })
  async getOffersForClassified(
    @User() user: UserDetails,
    @Param('classifiedId') classifiedId: string
  ) {
    return this.sendOfferCommand(
      { cmd: PaymentCommands.GET_OFFERS_FOR_CLASSIFIED },
      { classifiedId, userId: user.userId },
      'Classified offers not found'
    );
  }

  @Get('offers/user')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user offers (as buyer and seller)' })
  async getUserOffers(@User() user: UserDetails) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_USER_OFFERS },
        { userId: user.userId }
      )
    );
  }

  @Get('seller/wallet')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller wallet' })
  async getSellerWallet(@User() user: UserDetails) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_SELLER_WALLET },
        { sellerId: user.userId }
      )
    );
  }

  @Patch('seller/wallet/payout-info')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update seller payout information' })
  async updateSellerPayoutInfo(
    @User() user: UserDetails,
    @Body() dto: UpdatePayoutInfoDto
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.UPDATE_SELLER_PAYOUT_INFO },
        {
          sellerId: user.userId,
          payoutMethod: dto.payoutMethod,
          payoutEmail: dto.payoutEmail,
          bankAccountLast4: dto.bankAccountLast4,
          bankRoutingLast4: dto.bankRoutingLast4,
        }
      )
    );
  }

  @Post('seller/payout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a payout request' })
  async createPayoutRequest(
    @User() user: UserDetails,
    @Body() dto: CreatePayoutRequestDto
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_PAYOUT_REQUEST },
        {
          sellerId: user.userId,
          amount: dto.amount,
          payoutMethod: dto.payoutMethod,
          payoutEmail: dto.payoutEmail,
          bankAccountLast4: dto.bankAccountLast4,
          bankRoutingLast4: dto.bankRoutingLast4,
        }
      )
    );
  }

  @Get('seller/payouts')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller payout requests' })
  async getSellerPayoutRequests(@User() user: UserDetails) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_SELLER_PAYOUT_REQUESTS },
        { sellerId: user.userId }
      )
    );
  }

  @Delete('seller/payout/:payoutRequestId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a payout request' })
  async cancelPayoutRequest(
    @User() user: UserDetails,
    @Param('payoutRequestId') payoutRequestId: string
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CANCEL_PAYOUT_REQUEST },
        {
          payoutRequestId,
          sellerId: user.userId,
        }
      )
    );
  }

  @Get('seller/earnings')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller earnings summary' })
  async getSellerEarningsSummary(@User() user: UserDetails) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_SELLER_EARNINGS_SUMMARY },
        { sellerId: user.userId }
      )
    );
  }

  @Post('business/:businessPageId/theme')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create business page theme' })
  async createBusinessTheme(
    @User() user: UserDetails,
    @Param('businessPageId') businessPageId: string,
    @Body() dto: Record<string, unknown>
  ) {
    // O13 dual-write (decided): payments theme first, then the social mirror
    // keyed by the payments page id (no community context on this route, so
    // no page lookup — the mirror carries the payments id as its key).
    const theme = (await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_BUSINESS_THEME },
        { userId: user.userId, businessPageId, ...dto }
      )
    )) as { id: string };
    try {
      await firstValueFrom(
        this.socialClient.send(
          { cmd: BusinessContentCommands.THEME_CREATE },
          { businessPageId, ...(dto as Record<string, unknown>) }
        )
      );
    } catch (error) {
      this.logger.warn(
        `Social theme mirror failed for page ${businessPageId}: ${
          (error as Error)?.message ?? error
        }`
      );
    }
    return theme;
  }

  @Get('business/:businessPageId/theme')
  @Public()
  @ApiOperation({ summary: 'Get business page theme' })
  async getBusinessTheme(@Param('businessPageId') businessPageId: string) {
    // O13 fan-out (decided): social mirror wins when present (dual-written
    // on create); otherwise the payments row, unchanged.
    const content = await firstValueFrom(
      this.socialClient.send(
        { cmd: BusinessContentCommands.THEME_GET },
        { businessPageId }
      )
    ).catch(() => null);
    if (content) {
      return content;
    }
    return await firstValueFrom(
      this.paymentsClient
        .send({ cmd: PaymentCommands.GET_BUSINESS_THEME }, { businessPageId })
        .pipe(defaultIfEmpty(null))
    );
  }

  @Patch('business/theme/:themeId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update business page theme' })
  async updateBusinessTheme(
    @User() user: UserDetails,
    @Param('themeId') themeId: string,
    @Body() dto: Record<string, unknown>
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.UPDATE_BUSINESS_THEME },
        { userId: user.userId, themeId, ...dto }
      )
    );
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Lemon Squeezy webhook receiver' })
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') signatureHeader?: string
  ) {
    const secret = this.configService.get<string>('payments.webhookSecret');

    if (!secret) {
      // Fail closed: never process an unverifiable webhook when the signing
      // secret is misconfigured. Do not log the payload or secret.
      this.logger.error(
        'Rejecting Lemon Squeezy webhook: signing secret is not configured'
      );
      throw new UnauthorizedException('Webhook signature verification failed');
    }

    if (!signatureHeader) {
      this.logger.warn(
        'Rejecting Lemon Squeezy webhook: missing X-Signature header'
      );
      throw new UnauthorizedException('Webhook signature verification failed');
    }

    if (!verifyWebhookSignature(request.rawBody, signatureHeader, secret)) {
      this.logger.warn('Rejecting Lemon Squeezy webhook: invalid signature');
      throw new UnauthorizedException('Webhook signature verification failed');
    }

    return await firstValueFrom(
      this.paymentsClient
        .send(
          { cmd: PaymentCommands.PROCESS_WEBHOOK },
          { eventType: (body?.meta as any)?.event_name, data: body }
        )
        .pipe(defaultIfEmpty({ received: true }))
    );
  }
}
