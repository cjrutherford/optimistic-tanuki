import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from '@optimistic-tanuki/models';

@Controller()
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @MessagePattern({ cmd: 'createDonation' })
  create(@Payload() createDonationDto: CreateDonationDto) {
    return this.donationsService.create(createDonationDto);
  }

  @MessagePattern({ cmd: 'findAllDonations' })
  findAll() {
    return this.donationsService.findAll();
  }

  @MessagePattern({ cmd: 'findUserDonations' })
  findUserDonations(@Payload() userId: string) {
    return this.donationsService.findByUser(userId);
  }

  @MessagePattern({ cmd: 'findOneDonation' })
  findOne(@Payload() id: string) {
    return this.donationsService.findOne(id);
  }
}
