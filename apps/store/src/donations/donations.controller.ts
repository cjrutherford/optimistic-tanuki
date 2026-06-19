import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DonationCommands } from '@optimistic-tanuki/constants';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from '@optimistic-tanuki/models';

@Controller()
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @MessagePattern(DonationCommands.CREATE_DONATION)
  create(@Payload() createDonationDto: CreateDonationDto) {
    return this.donationsService.create(createDonationDto);
  }

  @MessagePattern(DonationCommands.FIND_ALL_DONATIONS)
  findAll() {
    return this.donationsService.findAll();
  }

  @MessagePattern(DonationCommands.FIND_USER_DONATIONS)
  findUserDonations(@Payload() userId: string) {
    return this.donationsService.findByUser(userId);
  }

  @MessagePattern(DonationCommands.FIND_ONE_DONATION)
  findOne(@Payload() id: string) {
    return this.donationsService.findOne(id);
  }
}
