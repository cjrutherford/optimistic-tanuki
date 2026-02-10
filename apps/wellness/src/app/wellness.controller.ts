import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  DailyFourService,
  CreateDailyFourDto,
  UpdateDailyFourDto,
} from './services/daily-four.service';
import {
  DailySixService,
  CreateDailySixDto,
  UpdateDailySixDto,
} from './services/daily-six.service';
import { WellnessCommands } from './wellness.commands';

@Controller()
export class WellnessController {
  private readonly logger = new Logger(WellnessController.name);

  constructor(
    private readonly dailyFourService: DailyFourService,
    private readonly dailySixService: DailySixService
  ) {}

  @MessagePattern({ cmd: WellnessCommands.CREATE_DAILY_FOUR })
  async createDailyFour(
    @Payload() data: { profileId: string; dto: CreateDailyFourDto }
  ) {
    this.logger.log(`Creating DailyFour for profile ${data.profileId}`);
    return this.dailyFourService.create(data.profileId, data.dto);
  }

  @MessagePattern({ cmd: WellnessCommands.GET_DAILY_FOUR_BY_PROFILE })
  async getDailyFourByProfile(@Payload('profileId') profileId: string) {
    return this.dailyFourService.findByProfileId(profileId);
  }

  @MessagePattern({ cmd: WellnessCommands.GET_DAILY_FOUR_ALL })
  async getAllDailyFour(@Payload('publicOnly') publicOnly?: boolean) {
    return this.dailyFourService.findAll(publicOnly);
  }

  @MessagePattern({ cmd: WellnessCommands.UPDATE_DAILY_FOUR })
  async updateDailyFour(
    @Payload() data: { id: string; profileId: string; dto: UpdateDailyFourDto }
  ) {
    return this.dailyFourService.update(data.id, data.profileId, data.dto);
  }

  @MessagePattern({ cmd: WellnessCommands.DELETE_DAILY_FOUR })
  async deleteDailyFour(@Payload() data: { id: string; profileId: string }) {
    return this.dailyFourService.delete(data.id, data.profileId);
  }

  @MessagePattern({ cmd: WellnessCommands.CREATE_DAILY_SIX })
  async createDailySix(
    @Payload() data: { profileId: string; dto: CreateDailySixDto }
  ) {
    this.logger.log(`Creating DailySix for profile ${data.profileId}`);
    return this.dailySixService.create(data.profileId, data.dto);
  }

  @MessagePattern({ cmd: WellnessCommands.GET_DAILY_SIX_BY_PROFILE })
  async getDailySixByProfile(@Payload('profileId') profileId: string) {
    return this.dailySixService.findByProfileId(profileId);
  }

  @MessagePattern({ cmd: WellnessCommands.GET_DAILY_SIX_ALL })
  async getAllDailySix(@Payload('publicOnly') publicOnly?: boolean) {
    return this.dailySixService.findAll(publicOnly);
  }

  @MessagePattern({ cmd: WellnessCommands.UPDATE_DAILY_SIX })
  async updateDailySix(
    @Payload() data: { id: string; profileId: string; dto: UpdateDailySixDto }
  ) {
    return this.dailySixService.update(data.id, data.profileId, data.dto);
  }

  @MessagePattern({ cmd: WellnessCommands.DELETE_DAILY_SIX })
  async deleteDailySix(@Payload() data: { id: string; profileId: string }) {
    return this.dailySixService.delete(data.id, data.profileId);
  }
}
