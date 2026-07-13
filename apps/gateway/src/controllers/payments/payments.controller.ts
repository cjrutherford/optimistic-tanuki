import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Patch,
  Put,
  Query,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, defaultIfEmpty } from 'rxjs';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentCommands, VideoCommands } from '@optimistic-tanuki/constants';
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
  anchorLat?: number;
  anchorLng?: number;
}

export interface CampaignCreativeInputDto {
  placementType: 'pre-roll' | 'mid-roll' | 'post-roll' | 'on-page';
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageUrl?: string;
}

export interface CampaignTargetPlacementInputDto {
  targetType: 'channel' | 'community';
  targetId: string;
  placementType: 'pre-roll' | 'mid-roll' | 'post-roll' | 'on-page';
}

export interface CreateAdvertisingCampaignDto {
  businessPageId: string;
  name: string;
  budget?: number | null;
  startsAt: string;
  endsAt: string;
  creatives: CampaignCreativeInputDto[];
  targetPlacements: CampaignTargetPlacementInputDto[];
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
  private readonly videosClient: ReturnType<typeof ClientProxyFactory.create>;
  private readonly logger = new Logger(PaymentsController.name);

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
    const videosConfig =
      this.configService.get<TcpServiceConfig>('services.videos');
    this.videosClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: videosConfig.host, port: videosConfig.port },
    });
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
          sellerId: user.userId,
        }
      )
    );
  }

  @Post('classifieds/payment/:paymentId/dispute')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispute a payment' })
  async disputePayment(
    @User() user: UserDetails,
    @Param('paymentId') paymentId: string,
    @Body('reason') reason: string
  ) {
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
  async getPayment(@Param('paymentId') paymentId: string) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_PAYMENT },
        { paymentId }
      )
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
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_BUSINESS_CHECKOUT },
        {
          userId: user.userId,
          communityId: dto.communityId,
          tier: dto.tier,
          appScope,
        }
      )
    );
  }

  @Get('business/owner')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get business pages for the authenticated owner' })
  async getOwnerBusinessPages(@User() user: UserDetails) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_OWNER_BUSINESS_PAGES },
        {
          userId: user.userId,
        }
      )
    );
  }

  @Patch('business/owner/:businessPageId/channel/:channelId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Associate an owned business page with an owned channel',
  })
  async assignBusinessChannel(
    @User() user: UserDetails,
    @Param('businessPageId') businessPageId: string,
    @Param('channelId') channelId: string
  ) {
    const pages = await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_OWNER_BUSINESS_PAGES },
        { userId: user.userId }
      )
    );
    if (!pages.some((page: { id: string }) => page.id === businessPageId)) {
      throw new Error('Business page not found');
    }

    return firstValueFrom(
      this.videosClient.send(
        { cmd: VideoCommands.ASSIGN_CHANNEL_BUSINESS_PAGE },
        { channelId, userId: user.userId, businessPageId }
      )
    );
  }

  @Get('business/:communityId')
  @Public()
  @ApiOperation({ summary: 'Get business page for community' })
  async getBusinessPage(@Param('communityId') communityId: string) {
    return await firstValueFrom(
      this.paymentsClient
        .send(
          { cmd: PaymentCommands.GET_BUSINESS_PAGE },
          {
            communityId,
          }
        )
        .pipe(defaultIfEmpty(null))
    );
  }

  @Get('business/city/:cityId')
  @Public()
  @ApiOperation({ summary: 'Get business pages for all communities in a city' })
  async getBusinessPagesByCity(
    @Param('cityId') cityId: string,
    @Query('communityIds') communityIds?: string
  ) {
    const ids = communityIds ? communityIds.split(',') : [];
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_BUSINESS_PAGES_BY_CITY },
        {
          cityId,
          communityIds: ids,
        }
      )
    );
  }

  @Patch('business/owner/:businessPageId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an owner business page by id' })
  async updateOwnerBusinessPage(
    @User() user: UserDetails,
    @Param('businessPageId') businessPageId: string,
    @Body() dto: UpdateBusinessPageDto
  ) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.UPDATE_OWNER_BUSINESS_PAGE },
        {
          userId: user.userId,
          businessPageId,
          ...dto,
        }
      )
    );
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
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.UPDATE_BUSINESS_PAGE },
        {
          userId: user.userId,
          communityId,
          ...dto,
        }
      )
    );
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

  @Post('advertising-campaigns')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an owner-managed advertising campaign' })
  async createAdvertisingCampaign(
    @User() user: UserDetails,
    @Body() dto: CreateAdvertisingCampaignDto
  ) {
    return firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_ADVERTISING_CAMPAIGN },
        { userId: user.userId, ...dto }
      )
    );
  }

  @Put('advertising-campaigns/:campaignId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an owner-managed advertising campaign' })
  async updateAdvertisingCampaign(
    @User() user: UserDetails,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateAdvertisingCampaignDto
  ) {
    return firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.UPDATE_ADVERTISING_CAMPAIGN },
        { userId: user.userId, campaignId, ...dto }
      )
    );
  }

  @Get('advertising-campaigns/owner')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List owner advertising campaigns' })
  async getOwnerAdvertisingCampaigns(@User() user: UserDetails) {
    return firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_OWNER_ADVERTISING_CAMPAIGNS },
        { userId: user.userId }
      )
    );
  }

  @Patch('advertising-campaigns/:campaignId/status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set owner advertising campaign lifecycle status' })
  async updateAdvertisingCampaignStatus(
    @User() user: UserDetails,
    @Param('campaignId') campaignId: string,
    @Body() dto: { status: 'draft' | 'active' | 'paused' | 'archived' }
  ) {
    return firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.UPDATE_ADVERTISING_CAMPAIGN_STATUS },
        { userId: user.userId, campaignId, status: dto.status }
      )
    );
  }

  @Get('advertising-campaigns/eligible/on-page')
  @Public()
  @ApiOperation({ summary: 'Discover eligible on-page advertising campaigns' })
  async getEligibleOnPageCampaigns(
    @Query('channelId') channelId?: string,
    @Query('communityId') communityId?: string
  ) {
    return firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_ELIGIBLE_ON_PAGE_CAMPAIGNS },
        { channelId, communityId }
      )
    );
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
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.ACCEPT_OFFER },
        {
          offerId,
          sellerId: user.userId,
        }
      )
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
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.REJECT_OFFER },
        {
          offerId,
          sellerId: user.userId,
        }
      )
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
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.COUNTER_OFFER },
        {
          offerId,
          sellerId: user.userId,
          counterAmount: dto.counterAmount,
          message: dto.message,
        }
      )
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
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.WITHDRAW_OFFER },
        {
          offerId,
          buyerId: user.userId,
        }
      )
    );
  }

  @Get('offers/classified/:classifiedId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get offers for a classified' })
  async getOffersForClassified(@Param('classifiedId') classifiedId: string) {
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.GET_OFFERS_FOR_CLASSIFIED },
        { classifiedId }
      )
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
        { sellerId: user.profileId || user.userId }
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
          sellerId: user.profileId || user.userId,
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
          sellerId: user.profileId || user.userId,
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
        { sellerId: user.profileId || user.userId }
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
          sellerId: user.profileId || user.userId,
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
        { sellerId: user.profileId || user.userId }
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
    return await firstValueFrom(
      this.paymentsClient.send(
        { cmd: PaymentCommands.CREATE_BUSINESS_THEME },
        { userId: user.userId, businessPageId, ...dto }
      )
    );
  }

  @Get('business/:businessPageId/theme')
  @Public()
  @ApiOperation({ summary: 'Get business page theme' })
  async getBusinessTheme(@Param('businessPageId') businessPageId: string) {
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
