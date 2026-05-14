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

  private async loadLeadContext() {
    const result = (await firstValueFrom(
      this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
        configKey: 'default',
      })
    )) as { config?: Record<string, any> } | null;

    return this.getBusinessLeadContext(result?.config);
  }

  private async loadSiteConfig() {
    const result = (await firstValueFrom(
      this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
        configKey: 'default',
      })
    )) as { config?: Record<string, any> } | null;

    return result?.config ?? {};
  }

  private async loadActiveStoreServiceProducts() {
    const products = (await firstValueFrom(
      this.storeService.send(ProductCommands.FIND_ALL_PRODUCTS, {})
    )) as Array<any>;

    return products.filter(
      (product) => product?.active !== false && product?.type === 'service'
    );
  }

  private async assertStoreCatalogPublishReady() {
    const serviceProducts = await this.loadActiveStoreServiceProducts();

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

  private async loadBusinessLeads() {
    const leadContext = await this.loadLeadContext();
    const leads = (await firstValueFrom(
      this.leadService.send({ cmd: LeadCommands.FIND_ALL }, leadContext)
    )) as any[];

    return {
      leadContext,
      leads,
    };
  }

  private async requireAcceptedClient(user: UserDetails) {
    const { leads } = await this.loadBusinessLeads();
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
  async getOffers() {
    const configResult = (await firstValueFrom(
      this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
        configKey: 'default',
      })
    )) as { config?: Record<string, any> } | null;
    const serviceCatalogSource =
      configResult?.config?.serviceCatalog?.source ?? 'manual';
    const configuredServices = Array.isArray(configResult?.config?.services)
      ? configResult?.config?.services
      : [];

    if (serviceCatalogSource === 'manual' && configuredServices.length) {
      return configuredServices.map((service: any) => ({
        id: service.id,
        label: service.name,
        description: service.description || 'Owner-defined offer.',
        serviceType: service.name,
        startingRate: Number(service.price || 0),
      }));
    }

    const serviceProducts = await this.loadActiveStoreServiceProducts();

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
  getAvailabilities() {
    return firstValueFrom(
      this.storeService.send(AvailabilityCommands.FIND_ALL_AVAILABILITIES, {})
    );
  }

  @Get('availability-overrides')
  getAvailabilityOverrides() {
    return firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.FIND_ALL_AVAILABILITY_OVERRIDES,
        {}
      )
    );
  }

  @Get('busy-windows')
  async getBusyWindows() {
    const appointments = (await firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_ALL_APPOINTMENTS, {})
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

  @Get('site-config')
  async getSiteConfig() {
    try {
      const result = await firstValueFrom(
        this.storeService.send(TrainerConfigCommands.GET_CONFIG, {
          configKey: 'default',
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
    @User() user: UserDetails
  ) {
    await this.requireAcceptedClient(user);

    return firstValueFrom(
      this.storeService.send(AppointmentCommands.CREATE_APPOINTMENT, {
        ...payload,
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
  getClientBookings(@User() user: UserDetails) {
    return firstValueFrom(
      this.storeService.send(
        AppointmentCommands.FIND_USER_APPOINTMENTS,
        user.userId
      )
    );
  }

  @UseGuards(AuthGuard)
  @Get('client/invoices')
  getClientInvoices(@User() user: UserDetails) {
    return firstValueFrom(
      this.storeService.send(
        AppointmentCommands.FIND_USER_INVOICES,
        user.userId
      )
    );
  }

  @UseGuards(AuthGuard)
  @Post('client/invoices/:id/pay')
  async payClientInvoice(@Param('id') id: string, @User() user: UserDetails) {
    const config = await this.loadSiteConfig();
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
  async getClientBookingStatus(@User() user: UserDetails) {
    const { leads } = await this.loadBusinessLeads();
    const lead = leads.find((entry) => entry?.userId === user.userId) ?? null;

    return {
      accepted: !!lead && this.isAcceptedLead(lead),
      leadId: lead?.id ?? null,
      leadStatus: lead?.status ?? null,
    };
  }

  // ─── Owner-protected endpoints ────────────────────────────────────────────

  @RequirePermissions('app-config.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('owner/bookings')
  getOwnerBookings() {
    return firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_ALL_APPOINTMENTS, {})
    );
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
    @User() user: UserDetails
  ) {
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
          configKey: 'default',
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
    @Body() payload: { configId?: string | null; source: 'manual' | 'store' },
    @User() user: UserDetails
  ) {
    if (payload.source === 'store') {
      await this.assertStoreCatalogPublishReady();
    }

    const existingConfig = await this.loadSiteConfig();
    const nextConfig = {
      ...existingConfig,
      leadContext: {
        profileId: user.profileId,
        appScope: 'business-site',
      },
      serviceCatalog: {
        ...(existingConfig?.serviceCatalog ?? {}),
        source: payload.source,
      },
    };

    if (!payload.configId) {
      return firstValueFrom(
        this.storeService.send(TrainerConfigCommands.CREATE_CONFIG, {
          configKey: 'default',
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
  getClientRoutines(@Query('clientId') clientId: string) {
    return firstValueFrom(
      this.storeService.send('trainer.client.routines.find', { clientId })
    );
  }

  @UseGuards(AuthGuard)
  @Post('client/routines/:id/complete')
  async completeClientRoutine(
    @Param('id') id: string,
    @User() user: UserDetails
  ) {
    const config = await this.loadSiteConfig();
    if (config?.features?.clientTasks?.allowClientCompletion !== true) {
      throw new BadRequestException(
        'Client completion is disabled for this business.'
      );
    }

    return firstValueFrom(
      this.storeService.send('trainer.client.routines.complete', {
        id,
        userId: user.userId,
      })
    );
  }

  @UseGuards(AuthGuard)
  @Post('client/check-ins')
  submitCheckIn(@Body() payload: Record<string, unknown>) {
    return firstValueFrom(
      this.storeService.send('trainer.client.checkins.create', payload)
    );
  }

  @UseGuards(AuthGuard)
  @Get('client/check-ins')
  getClientCheckIns(@Query('clientId') clientId: string) {
    return firstValueFrom(
      this.storeService.send('trainer.client.checkins.find', { clientId })
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
}
