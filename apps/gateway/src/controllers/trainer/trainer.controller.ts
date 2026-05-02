import {
  Body,
  Controller,
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
  AppConfigCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { ApproveAppointmentDto, CreateAppointmentDto } from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';

@Controller('trainer')
export class TrainerController {
  constructor(
    @Inject(ServiceTokens.STORE_SERVICE)
    private readonly storeService: ClientProxy,
    @Inject(ServiceTokens.APP_CONFIGURATOR_SERVICE)
    private readonly appConfigService: ClientProxy
  ) {}

  // ─── Public endpoints ────────────────────────────────────────────────────────

  @Get('offers')
  async getOffers() {
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
        description:
          'Bookable session track derived from active trainer availability.',
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

  @Get('site-config')
  async getSiteConfig() {
    try {
      const result = await firstValueFrom(
        this.appConfigService.send(
          { cmd: AppConfigCommands.GetByName },
          { name: 'trainer-site' }
        )
      );
      if (!result) {
        return { configId: null, config: null };
      }
      return result;
    } catch {
      return { configId: null, config: null };
    }
  }

  // ─── Client booking endpoints ─────────────────────────────────────────────

  @Post('bookings')
  createBooking(@Body() payload: CreateAppointmentDto) {
    return firstValueFrom(
      this.storeService.send(AppointmentCommands.CREATE_APPOINTMENT, payload)
    );
  }

  @Get('bookings')
  getClientBookings(@Query('userId') userId: string) {
    return firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_USER_APPOINTMENTS, userId)
    );
  }

  // ─── Owner-protected endpoints ────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Get('owner/bookings')
  getOwnerBookings() {
    return firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_ALL_APPOINTMENTS, {})
    );
  }

  @UseGuards(AuthGuard)
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

  @UseGuards(AuthGuard)
  @Put('owner/bookings/:id/complete')
  completeBooking(@Param('id') id: string) {
    return firstValueFrom(
      this.storeService.send(AppointmentCommands.COMPLETE_APPOINTMENT, id)
    );
  }

  @UseGuards(AuthGuard)
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
    @Body() payload: { configId?: string | null; config: Record<string, unknown> }
  ) {
    if (!payload.configId) {
      return firstValueFrom(
        this.appConfigService.send(
          { cmd: AppConfigCommands.Create },
          { domain: 'trainer-site', name: 'trainer-site', config: payload.config }
        )
      );
    }
    return firstValueFrom(
      this.appConfigService.send(
        { cmd: AppConfigCommands.Update },
        { id: payload.configId, config: payload.config }
      )
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

  @UseGuards(AuthGuard)
  @Get('owner/routines')
  getOwnerRoutines() {
    return firstValueFrom(
      this.storeService.send('trainer.owner.routines.findAll', {})
    );
  }

  @UseGuards(AuthGuard)
  @Post('owner/routines')
  assignRoutine(@Body() payload: Record<string, unknown>) {
    return firstValueFrom(
      this.storeService.send('trainer.owner.routines.assign', payload)
    );
  }
}
