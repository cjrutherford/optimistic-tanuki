import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  AppointmentCommands,
  AvailabilityCommands,
  LeadCommands,
  ProductCommands,
  ServiceTokens,
  TrainerConfigCommands,
} from '@optimistic-tanuki/constants';
import {
  ApproveAppointmentDto,
  AvailabilityOverrideMode,
  CreateAppointmentDto,
  CreateAvailabilityDto,
  CreateAvailabilityOverrideDto,
  CreateLeadDto,
  LeadSource,
  LeadStatus,
  UpdateAvailabilityDto,
  UpdateAvailabilityOverrideDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';

type BusinessLeadIntakeDto = {
  siteSlug?: string;
  name: string;
  email?: string;
  phone?: string;
  goal: string;
  context?: string;
  preferredStart?: string;
  preferredEnd?: string;
  userId?: string;
  profileId?: string;
};

@Controller(['trainer', 'business'])
export class TrainerController {
  constructor(
    @Inject(ServiceTokens.STORE_SERVICE)
    private readonly storeService: ClientProxy,
    @Inject(ServiceTokens.LEAD_SERVICE)
    private readonly leadService: ClientProxy
  ) {}

  private getBusinessLeadContext(
    config: Record<string, any> | null | undefined
  ) {
    const profileId = config?.leadContext?.profileId;
    const appScope = config?.leadContext?.appScope || 'business-site';

    if (!profileId) {
      throw new BadRequestException(
        'Business lead intake is not configured yet.'
      );
    }

    return { profileId, appScope };
  }

  private buildLeadNotes(
    payload: BusinessLeadIntakeDto,
    profileId?: string
  ): string {
    return [
      `Goal: ${payload.goal}`,
      payload.context ? `Context: ${payload.context}` : null,
      payload.preferredStart
        ? `Preferred start: ${payload.preferredStart}`
        : null,
      payload.preferredEnd ? `Preferred end: ${payload.preferredEnd}` : null,
      profileId ? `Linked profile: ${profileId}` : null,
      'Business-site intake',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private resolveBusinessLeadName(payload: BusinessLeadIntakeDto): string {
    return (
      payload.name?.trim() ||
      payload.email?.trim() ||
      payload.phone?.trim() ||
      payload.goal?.trim() ||
      'Business-site lead'
    );
  }

  private toProspectRecord(lead: any) {
    const accountStatus =
      lead?.userId && lead.userId !== 'anonymous-business-site'
        ? 'Linked client'
        : 'No account';

    return {
      ...lead,
      accountStatus,
    };
  }

  private isAcceptedLead(lead: any): boolean {
    return lead?.status === LeadStatus.WON;
  }

  private async loadOwnerAppointments(ownerId: string) {
    return (await firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_ALL_APPOINTMENTS, {
        ownerId,
      })
    )) as any[];
  }

  private latestBooking(bookings: any[]): any | null {
    return (
      [...bookings]
        .sort((a, b) => {
          const aTime = new Date(a?.startTime ?? a?.updatedAt ?? 0).getTime();
          const bTime = new Date(b?.startTime ?? b?.updatedAt ?? 0).getTime();
          return bTime - aTime;
        })
        .at(0) ?? null
    );
  }

  private buildClientLifecycleStatus(
    lead: any | null,
    bookings: any[]
  ): {
    stage:
      | 'new_lead'
      | 'lead_under_review'
      | 'accepted_client'
      | 'booking_requested'
      | 'booking_confirmed'
      | 'session_completed'
      | 'invoice_due';
    nextAction: string;
    primaryAction: 'request_consultation' | 'await_review' | 'book_session';
  } {
    if (!lead) {
      return {
        stage: 'new_lead',
        nextAction:
          'Share your goals to request a consultation and start the review process.',
        primaryAction: 'request_consultation',
      };
    }

    if (!this.isAcceptedLead(lead)) {
      return {
        stage: 'lead_under_review',
        nextAction:
          'Your request is under review. The business will follow up before booking opens.',
        primaryAction: 'await_review',
      };
    }

    const latestBooking = this.latestBooking(bookings);

    if (!latestBooking) {
      return {
        stage: 'accepted_client',
        nextAction: 'Choose a published time to request your next session.',
        primaryAction: 'book_session',
      };
    }

    if (latestBooking.status === 'pending') {
      return {
        stage: 'booking_requested',
        nextAction: 'Your booking request is pending business confirmation.',
        primaryAction: 'book_session',
      };
    }

    if (latestBooking.status === 'approved') {
      return {
        stage: 'booking_confirmed',
        nextAction:
          'Your booking is scheduled. Review the details in your client workspace.',
        primaryAction: 'book_session',
      };
    }

    if (
      latestBooking.status === 'completed' &&
      Number(latestBooking.totalCost)
    ) {
      return {
        stage: 'invoice_due',
        nextAction:
          'Your session is complete. Pay the invoice in your client workspace.',
        primaryAction: 'book_session',
      };
    }

    return {
      stage: 'session_completed',
      nextAction:
        'Your session is complete. Watch for follow-up and billing details.',
      primaryAction: 'book_session',
    };
  }

  private buildOwnerWorkflow(leads: any[], bookings: any[]) {
    const leadByUserId = new Map(
      leads
        .filter((lead) => typeof lead?.userId === 'string' && lead.userId)
        .map((lead) => [lead.userId, lead])
    );

    const workflow: Array<Record<string, unknown>> = leads
      .filter((lead) => !this.isAcceptedLead(lead))
      .map((lead) => ({
        id: `lead:${lead.id}`,
        leadId: lead.id,
        title: lead.name || lead.email || 'New lead',
        subtitle: lead.email || lead.phone || lead.source || '',
        statusLabel: String(lead.status || 'new'),
        stage:
          lead.status === LeadStatus.CONTACTED
            ? ('lead_under_review' as const)
            : ('new_lead' as const),
        bucket: 'needs_response' as const,
        nextAction: 'Accept the client or follow up before booking.',
        details: [
          lead?.userId && lead.userId !== 'anonymous-business-site'
            ? 'Linked client account'
            : 'No account',
          lead.notes || 'No intake notes provided.',
        ],
        primaryAction: 'accept_client' as const,
      }));

    for (const booking of bookings) {
      const lead = leadByUserId.get(booking.userId);
      const title = lead?.name || booking.title || 'Client booking';
      const subtitle =
        lead?.email ||
        lead?.phone ||
        this.formatWindow(booking.startTime, booking.endTime);

      if (booking.status === 'pending') {
        workflow.push({
          id: `booking:${booking.id}`,
          bookingId: booking.id,
          title,
          subtitle,
          statusLabel: 'pending',
          stage: 'booking_requested',
          bucket: 'ready_to_schedule',
          nextAction: 'Review the request and confirm the schedule.',
          details: [
            booking.description || 'No client context provided.',
            this.formatWindow(booking.startTime, booking.endTime),
          ],
          primaryAction: 'approve_booking',
        });
        continue;
      }

      if (booking.status === 'approved') {
        workflow.push({
          id: `booking:${booking.id}`,
          bookingId: booking.id,
          title,
          subtitle,
          statusLabel: 'approved',
          stage: 'booking_confirmed',
          bucket: 'active_clients',
          nextAction: 'Complete the session when delivery is finished.',
          details: [this.formatWindow(booking.startTime, booking.endTime)],
          primaryAction: 'complete_booking',
        });
        continue;
      }

      if (booking.status === 'completed' && !Number(booking.totalCost)) {
        workflow.push({
          id: `booking:${booking.id}`,
          bookingId: booking.id,
          title,
          subtitle,
          statusLabel: 'completed',
          stage: 'session_completed',
          bucket: 'needs_invoicing',
          nextAction: 'Generate the invoice for the completed session.',
          details: [this.formatWindow(booking.startTime, booking.endTime)],
          primaryAction: 'generate_invoice',
        });
        continue;
      }

      if (booking.status === 'completed' && Number(booking.totalCost)) {
        workflow.push({
          id: `booking:${booking.id}`,
          bookingId: booking.id,
          title,
          subtitle,
          statusLabel: 'invoice due',
          stage: 'invoice_due',
          bucket: 'active_clients',
          nextAction: 'Payment is still outstanding for this completed work.',
          details: [
            this.formatWindow(booking.startTime, booking.endTime),
            `Invoice total: $${booking.totalCost}`,
          ],
          primaryAction: 'none',
        });
      }
    }

    return workflow;
  }

  private async loadLeadContext() {
    const result = (await firstValueFrom(
      this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
        configKey: 'default',
      })
    )) as { config?: Record<string, any> } | null;

    return this.getBusinessLeadContext(result?.config);
  }

  private async loadSiteConfigBySlug(slug?: string) {
    const normalizedSlug = slug?.trim();
    const result = (await firstValueFrom(
      this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
        configKey: 'default',
        slug: normalizedSlug || undefined,
      })
    )) as { config?: Record<string, any> } | null;

    return result?.config ?? {};
  }

  private async loadOwnerUserIdForSlug(slug?: string): Promise<string | null> {
    const config = await this.loadSiteConfigBySlug(slug);
    const ownerUserId = config?.site?.ownerUserId;

    return typeof ownerUserId === 'string' && ownerUserId.trim()
      ? ownerUserId.trim()
      : null;
  }

  private async loadSiteConfig() {
    const result = (await firstValueFrom(
      this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
        configKey: 'default',
      })
    )) as { config?: Record<string, any> } | null;

    return result?.config ?? {};
  }

  @Get('sites')
  async listPublishedSites() {
    return firstValueFrom(
      this.storeService.send(
        TrainerConfigCommands.LIST_PUBLIC_SITE_SUMMARIES,
        {}
      )
    );
  }

  private async loadActiveStoreServiceProducts(ownerId?: string | null) {
    const products = (await firstValueFrom(
      ownerId
        ? this.storeService.send(ProductCommands.FIND_OWNER_PRODUCTS, ownerId)
        : this.storeService.send(ProductCommands.FIND_ALL_PRODUCTS, {})
    )) as Array<any>;

    if (!Array.isArray(products)) {
      return [];
    }

    return products.filter(
      (product) => product?.active !== false && product?.type === 'service'
    );
  }

  private async assertStoreCatalogPublishReady(ownerId?: string | null) {
    const serviceProducts = await this.loadActiveStoreServiceProducts(ownerId);

    if (!serviceProducts.length) {
      throw new BadRequestException(
        'At least one active store service product is required before enabling store mode.'
      );
    }

    const hasMissingDescription = serviceProducts.some(
      (product) => !product?.description?.trim()
    );
    const hasInvalidPrice = serviceProducts.some(
      (product) => Number(product?.price) <= 0
    );

    if (hasMissingDescription || hasInvalidPrice) {
      throw new BadRequestException(
        'Store mode requires publish-ready service products with descriptions and prices greater than zero.'
      );
    }
  }

  private async loadBusinessLeads(slug?: string) {
    const leadContext = slug
      ? this.getBusinessLeadContext(await this.loadSiteConfigBySlug(slug))
      : await this.loadLeadContext();
    const leads = (await firstValueFrom(
      this.leadService.send({ cmd: LeadCommands.FIND_ALL }, leadContext)
    )) as any[];

    return {
      leadContext,
      leads,
    };
  }

  private formatWindow(
    startTime: string | Date | undefined,
    endTime: string | Date | undefined
  ): string {
    if (!startTime || !endTime) {
      return 'Schedule pending';
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Schedule pending';
    }

    return `${start.toLocaleString()} - ${end.toLocaleString()}`;
  }

  private async requireAcceptedClient(user: UserDetails, slug?: string) {
    const { leads } = await this.loadBusinessLeads(slug);
    const acceptedLead =
      leads.find(
        (lead) => lead?.userId === user.userId && this.isAcceptedLead(lead)
      ) ?? null;

    if (!acceptedLead) {
      throw new BadRequestException(
        'Client must be accepted by the business before booking.'
      );
    }

    return acceptedLead;
  }

  // ─── Public endpoints ────────────────────────────────────────────────────────

  @Get('offers')
  async getOffers(@Query('slug') slug?: string) {
    const configResult = (await firstValueFrom(
      this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
        configKey: 'default',
        slug: slug?.trim() || undefined,
      })
    )) as { config?: Record<string, any> } | null;
    const serviceCatalogSource =
      configResult?.config?.serviceCatalog?.source ?? 'manual';
    const configuredServices = Array.isArray(configResult?.config?.services)
      ? configResult?.config?.services
      : [];
    const ownerUserId =
      typeof configResult?.config?.site?.ownerUserId === 'string' &&
      configResult.config.site.ownerUserId.trim()
        ? configResult.config.site.ownerUserId.trim()
        : null;

    if (serviceCatalogSource === 'manual' && configuredServices.length) {
      return configuredServices.map((service: any) => ({
        id: service.id,
        label: service.name,
        description: service.description || 'Owner-defined offer.',
        serviceType: service.name,
        startingRate: Number(service.price || 0),
      }));
    }

    const serviceProducts = await this.loadActiveStoreServiceProducts(
      ownerUserId
    );

    if (serviceProducts.length) {
      return serviceProducts.map((product) => ({
        id: product.id,
        label: product.name,
        description: product.description || 'Store-backed service offer.',
        serviceType: product.type,
        startingRate: Number(product.price || 0),
        allowOnlineBooking: true,
      }));
    }

    const availabilities = (await firstValueFrom(
      this.storeService.send(AvailabilityCommands.FIND_ALL_AVAILABILITIES, {})
    )) as Array<any>;

    const seen = new Set<string>();

    return availabilities
      .filter((availability) => availability.isActive !== false)
      .filter((availability) => {
        const key = availability.serviceType || availability.id;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map((availability) => ({
        id: availability.id,
        label: availability.serviceType || 'Coaching Session',
        description: 'Bookable service derived from active availability.',
        serviceType: availability.serviceType || 'general',
        startingRate: Number(availability.hourlyRate || 0),
      }));
  }

  @Get('availabilities')
  async getAvailabilities(@Query('slug') slug?: string) {
    const ownerUserId = await this.loadOwnerUserIdForSlug(slug);

    if (ownerUserId) {
      return firstValueFrom(
        this.storeService.send(
          AvailabilityCommands.FIND_OWNER_AVAILABILITIES,
          ownerUserId
        )
      );
    }

    return firstValueFrom(
      this.storeService.send(AvailabilityCommands.FIND_ALL_AVAILABILITIES, {})
    );
  }

  @Get('availability-overrides')
  async getAvailabilityOverrides(@Query('slug') slug?: string) {
    const ownerUserId = await this.loadOwnerUserIdForSlug(slug);

    if (ownerUserId) {
      return firstValueFrom(
        this.storeService.send(
          AvailabilityCommands.FIND_OWNER_AVAILABILITY_OVERRIDES,
          ownerUserId
        )
      );
    }

    return firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.FIND_ALL_AVAILABILITY_OVERRIDES,
        {}
      )
    );
  }

  @Get('busy-windows')
  async getBusyWindows(@Query('slug') slug?: string) {
    const ownerUserId = await this.loadOwnerUserIdForSlug(slug);
    const appointments = (await firstValueFrom(
      this.storeService.send(
        AppointmentCommands.FIND_ALL_APPOINTMENTS,
        ownerUserId ? { ownerId: ownerUserId } : {}
      )
    )) as Array<any>;

    return appointments
      .filter(
        (appointment) =>
          appointment?.status !== 'cancelled' &&
          appointment?.status !== 'denied'
      )
      .map((appointment) => ({
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      }));
  }

  @Public()
  @UseGuards(AuthGuard)
  @Get('site-config')
  async getSiteConfig(
    @Query('slug') slug?: string,
    @User() user?: UserDetails | null
  ) {
    try {
      const result = await firstValueFrom(
        this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
          configKey: 'default',
          slug: slug?.trim() || undefined,
          profileId: slug?.trim() ? undefined : user?.profileId || undefined,
        })
      );
      if (!result || !result.config) {
        return { configId: null, config: null };
      }
      return result;
    } catch {
      return { configId: null, config: null };
    }
  }

  // ─── Client booking endpoints ─────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Post('bookings')
  async createBooking(
    @Body() payload: Omit<CreateAppointmentDto, 'userId'>,
    @User() user: UserDetails,
    @Query('slug') slug?: string
  ) {
    await this.requireAcceptedClient(user, slug || (payload as any)?.siteSlug);
    const ownerUserId = await this.loadOwnerUserIdForSlug(
      slug || (payload as any)?.siteSlug
    );

    return firstValueFrom(
      this.storeService.send(AppointmentCommands.CREATE_APPOINTMENT, {
        ...payload,
        ownerId: ownerUserId || undefined,
        userId: user.userId,
      })
    );
  }

  @Public()
  @UseGuards(AuthGuard)
  @Post('leads')
  async createLeadIntake(
    @Body() payload: BusinessLeadIntakeDto,
    @User() user?: UserDetails | null
  ) {
    const result = (await firstValueFrom(
      this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
        configKey: 'default',
        slug: payload.siteSlug?.trim() || undefined,
      })
    )) as { config?: Record<string, any> } | null;
    const leadContext = this.getBusinessLeadContext(result?.config);
    const linkedUserId =
      payload.userId || user?.userId || 'anonymous-business-site';
    const linkedProfileId = payload.profileId || user?.profileId || '';
    const dto: CreateLeadDto = {
      name: this.resolveBusinessLeadName(payload),
      email: payload.email,
      phone: payload.phone,
      source: LeadSource.OTHER,
      status: LeadStatus.NEW,
      notes: this.buildLeadNotes(payload, linkedProfileId),
      isAutoDiscovered: false,
      searchKeywords: ['business-site-intake'],
    };

    return firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.CREATE },
        {
          dto,
          context: {
            userId: linkedUserId,
            profileId: leadContext.profileId,
            appScope: leadContext.appScope,
          },
        }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Get('bookings')
  async getClientBookings(
    @User() user: UserDetails,
    @Query('slug') slug?: string
  ) {
    const ownerUserId = await this.loadOwnerUserIdForSlug(slug);

    return firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_USER_APPOINTMENTS, {
        userId: user.userId,
        ownerId: ownerUserId || undefined,
      })
    );
  }

  @UseGuards(AuthGuard)
  @Get('client/invoices')
  async getClientInvoices(
    @User() user: UserDetails,
    @Query('slug') slug?: string
  ) {
    const ownerUserId = await this.loadOwnerUserIdForSlug(slug);

    return firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_USER_INVOICES, {
        userId: user.userId,
        ownerId: ownerUserId || undefined,
      })
    );
  }

  @UseGuards(AuthGuard)
  @Post('client/invoices/:id/pay')
  async payClientInvoice(
    @Param('id') id: string,
    @User() user: UserDetails,
    @Query('slug') slug?: string
  ) {
    const config = slug
      ? await this.loadSiteConfigBySlug(slug)
      : await this.loadSiteConfig();
    if (config?.features?.booking?.allowOnlinePayment !== true) {
      throw new BadRequestException(
        'Online payment is disabled for this business.'
      );
    }

    return firstValueFrom(
      this.storeService.send(AppointmentCommands.PAY_INVOICE, {
        id,
        userId: user.userId,
      })
    );
  }

  @UseGuards(AuthGuard)
  @Get('client-status')
  async getClientBookingStatus(
    @User() user: UserDetails,
    @Query('slug') slug?: string
  ) {
    const { leads } = await this.loadBusinessLeads(slug);
    const lead = leads.find((entry) => entry?.userId === user.userId) ?? null;
    const ownerUserId = await this.loadOwnerUserIdForSlug(slug);
    const bookings = (await firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_USER_APPOINTMENTS, {
        userId: user.userId,
        ownerId: ownerUserId || undefined,
      })
    )) as any[];
    const lifecycle = this.buildClientLifecycleStatus(lead, bookings);

    return {
      accepted: !!lead && this.isAcceptedLead(lead),
      leadId: lead?.id ?? null,
      leadStatus: lead?.status ?? null,
      hasAccount: true,
      stage: lifecycle.stage,
      nextAction: lifecycle.nextAction,
      primaryAction: lifecycle.primaryAction,
    };
  }

  // ─── Owner-protected endpoints ────────────────────────────────────────────

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('owner/bookings')
  getOwnerBookings(@User() user: UserDetails) {
    return firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_ALL_APPOINTMENTS, {
        ownerId: user.userId,
      })
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('owner/workflow')
  async getOwnerWorkflow(
    @User() user: UserDetails,
    @Query('slug') slug?: string
  ) {
    const normalizedSlug = slug?.trim();
    const slugOwnerUserId = normalizedSlug
      ? await this.loadOwnerUserIdForSlug(normalizedSlug)
      : null;
    const ownerId = slugOwnerUserId || user.userId;
    const leads = (await this.loadBusinessLeads(normalizedSlug)).leads;
    const bookings = await this.loadOwnerAppointments(ownerId);

    return this.buildOwnerWorkflow(leads, bookings);
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('owner/leads')
  async getOwnerProspects(@User() user: UserDetails) {
    const leads = (await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.FIND_ALL },
        {
          profileId: user.profileId,
          appScope: 'business-site',
        }
      )
    )) as any[];

    return leads
      .filter((lead) => !this.isAcceptedLead(lead))
      .map((lead) => this.toProspectRecord(lead));
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('owner/leads/:id/contacted')
  async markOwnerProspectContacted(
    @Param('id') id: string,
    @User() user: UserDetails
  ) {
    const lead = await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.UPDATE },
        {
          id,
          profileId: user.profileId,
          dto: {
            status: LeadStatus.CONTACTED,
          },
        }
      )
    );

    return this.toProspectRecord(lead);
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('owner/leads/:id/approve')
  async approveOwnerProspect(
    @Param('id') id: string,
    @User() user: UserDetails
  ) {
    const lead = await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.UPDATE },
        {
          id,
          profileId: user.profileId,
          dto: {
            status: LeadStatus.WON,
          },
        }
      )
    );

    return this.toProspectRecord(lead);
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('owner/accepted-clients')
  async getAcceptedClients(@User() user: UserDetails) {
    const leads = (await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.FIND_ALL },
        {
          profileId: user.profileId,
          appScope: 'business-site',
        }
      )
    )) as any[];

    return leads
      .filter(
        (lead) =>
          this.isAcceptedLead(lead) &&
          !!lead?.userId &&
          lead.userId !== 'anonymous-business-site'
      )
      .map((lead) => ({
        leadId: lead.id,
        userId: lead.userId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        leadStatus: lead.status,
      }));
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('owner/availabilities')
  getOwnerAvailabilities(@User() user: UserDetails) {
    return firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.FIND_OWNER_AVAILABILITIES,
        user.userId
      )
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('owner/availabilities')
  createOwnerAvailability(
    @Body() payload: CreateAvailabilityDto,
    @User() user: UserDetails
  ) {
    return firstValueFrom(
      this.storeService.send(AvailabilityCommands.CREATE_AVAILABILITY, {
        ...payload,
        ownerId: payload.ownerId || user.userId,
      })
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('owner/availabilities/:id')
  updateOwnerAvailability(
    @Param('id') id: string,
    @Body() payload: UpdateAvailabilityDto
  ) {
    return firstValueFrom(
      this.storeService.send(AvailabilityCommands.UPDATE_AVAILABILITY, {
        id,
        updateAvailabilityDto: payload,
      })
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Delete('owner/availabilities/:id')
  removeOwnerAvailability(@Param('id') id: string) {
    return firstValueFrom(
      this.storeService.send(AvailabilityCommands.REMOVE_AVAILABILITY, id)
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('owner/availability-overrides')
  getOwnerAvailabilityOverrides(@User() user: UserDetails) {
    return firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.FIND_OWNER_AVAILABILITY_OVERRIDES,
        user.userId
      )
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('owner/availability-overrides')
  createOwnerAvailabilityOverride(
    @Body() payload: CreateAvailabilityOverrideDto,
    @User() user: UserDetails
  ) {
    return firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.CREATE_AVAILABILITY_OVERRIDE,
        {
          ...payload,
          ownerId: payload.ownerId || user.userId,
        }
      )
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('owner/availability-overrides/:id')
  updateOwnerAvailabilityOverride(
    @Param('id') id: string,
    @Body() payload: UpdateAvailabilityOverrideDto
  ) {
    return firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.UPDATE_AVAILABILITY_OVERRIDE,
        {
          id,
          updateAvailabilityOverrideDto: payload,
        }
      )
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Delete('owner/availability-overrides/:id')
  removeOwnerAvailabilityOverride(@Param('id') id: string) {
    return firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.REMOVE_AVAILABILITY_OVERRIDE,
        id
      )
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('owner/bookings/:id/approve')
  approveBooking(
    @Param('id') id: string,
    @Body() payload: ApproveAppointmentDto
  ) {
    return firstValueFrom(
      this.storeService.send(AppointmentCommands.APPROVE_APPOINTMENT, {
        id,
        approveAppointmentDto: payload,
      })
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('owner/bookings/:id/complete')
  completeBooking(@Param('id') id: string) {
    return firstValueFrom(
      this.storeService.send(AppointmentCommands.COMPLETE_APPOINTMENT, id)
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('owner/bookings/:id/invoice')
  generateInvoice(@Param('id') id: string) {
    return firstValueFrom(
      this.storeService.send(AppointmentCommands.GENERATE_INVOICE, id)
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('site-config')
  async updateSiteConfig(
    @Body()
    payload: { configId?: string | null; config: Record<string, unknown> },
    @User() user: UserDetails,
    @Query('slug') slug?: string
  ) {
    const normalizedSlug = slug?.trim();
    const config = {
      ...(payload.config ?? {}),
      leadContext: {
        profileId: user.profileId,
        appScope: 'business-site',
      },
    };

    if (!payload.configId) {
      return firstValueFrom(
        this.storeService.send(TrainerConfigCommands.CREATE_CONFIG, {
          configKey: normalizedSlug
            ? `business-site:${normalizedSlug}`
            : this.businessSiteConfigKey(user.profileId),
          ...config,
        })
      );
    }
    return firstValueFrom(
      this.storeService.send(TrainerConfigCommands.UPDATE_CONFIG, {
        id: payload.configId,
        config,
      })
    );
  }

  @RequirePermissions('business-site.catalog.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('site-config/catalog-source')
  async updateCatalogSource(
    @Body()
    payload: {
      configId?: string | null;
      source: 'manual' | 'store';
      storeEnabled?: boolean;
    },
    @User() user: UserDetails,
    @Query('slug') slug?: string
  ) {
    const normalizedSlug = slug?.trim();
    const catalogOwnerId = normalizedSlug
      ? (await this.loadOwnerUserIdForSlug(normalizedSlug)) || user.userId
      : user.userId;

    if (payload.source === 'store') {
      await this.assertStoreCatalogPublishReady(catalogOwnerId);
    }

    const existingConfig = normalizedSlug
      ? await this.loadSiteConfigBySlug(normalizedSlug)
      : await this.loadSiteConfig();
    const nextConfig = {
      ...existingConfig,
      leadContext: {
        profileId: user.profileId,
        appScope: 'business-site',
      },
      features: {
        ...(existingConfig?.features ?? {}),
        store: {
          ...(existingConfig?.features?.store ?? {}),
          enabled: payload.storeEnabled ?? false,
        },
      },
      serviceCatalog: {
        ...(existingConfig?.serviceCatalog ?? {}),
        source: payload.source,
      },
    };

    if (!payload.configId) {
      return firstValueFrom(
        this.storeService.send(TrainerConfigCommands.CREATE_CONFIG, {
          configKey: normalizedSlug
            ? `business-site:${normalizedSlug}`
            : this.businessSiteConfigKey(user.profileId),
          ...nextConfig,
        })
      );
    }

    return firstValueFrom(
      this.storeService.send(TrainerConfigCommands.UPDATE_CONFIG, {
        id: payload.configId,
        config: nextConfig,
      })
    );
  }

  // ─── Client routine and check-in endpoints ────────────────────────────────

  @UseGuards(AuthGuard)
  @Get('client/routines')
  async getClientRoutines(
    @Query('clientId') clientId: string,
    @Query('slug') slug?: string
  ) {
    const ownerUserId = await this.loadOwnerUserIdForSlug(slug);

    return firstValueFrom(
      this.storeService.send('trainer.client.routines.find', {
        clientId,
        ownerId: ownerUserId || undefined,
      })
    );
  }

  @UseGuards(AuthGuard)
  @Post('client/routines/:id/complete')
  async completeClientRoutine(
    @Param('id') id: string,
    @User() user: UserDetails,
    @Query('slug') slug?: string
  ) {
    const config = slug
      ? await this.loadSiteConfigBySlug(slug)
      : await this.loadSiteConfig();
    if (config?.features?.clientTasks?.allowClientCompletion !== true) {
      throw new BadRequestException(
        'Client completion is disabled for this business.'
      );
    }

    const ownerUserId = await this.loadOwnerUserIdForSlug(slug);

    return firstValueFrom(
      this.storeService.send('trainer.client.routines.complete', {
        id,
        userId: user.userId,
        ownerId: ownerUserId || undefined,
      })
    );
  }

  @UseGuards(AuthGuard)
  @Post('client/check-ins')
  async submitCheckIn(@Body() payload: Record<string, unknown>) {
    const ownerUserId = await this.loadOwnerUserIdForSlug(
      (payload as any)?.siteSlug
    );

    return firstValueFrom(
      this.storeService.send('trainer.client.checkins.create', {
        ...payload,
        ownerId: ownerUserId || undefined,
      })
    );
  }

  @UseGuards(AuthGuard)
  @Get('client/check-ins')
  async getClientCheckIns(
    @Query('clientId') clientId: string,
    @Query('slug') slug?: string
  ) {
    const ownerUserId = await this.loadOwnerUserIdForSlug(slug);

    return firstValueFrom(
      this.storeService.send('trainer.client.checkins.find', {
        clientId,
        ownerId: ownerUserId || undefined,
      })
    );
  }

  // ─── Owner routine management ─────────────────────────────────────────────

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('owner/routines')
  getOwnerRoutines() {
    return firstValueFrom(
      this.storeService.send('trainer.owner.routines.findAll', {})
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('owner/check-ins')
  getOwnerCheckIns() {
    return firstValueFrom(
      this.storeService.send('trainer.owner.checkins.findAll', {})
    );
  }

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('owner/routines')
  assignRoutine(@Body() payload: Record<string, unknown>) {
    return firstValueFrom(
      this.storeService.send('trainer.owner.routines.assign', payload)
    );
  }

  private businessSiteConfigKey(profileId: string): string {
    return `business-site:${profileId}`;
  }
}
