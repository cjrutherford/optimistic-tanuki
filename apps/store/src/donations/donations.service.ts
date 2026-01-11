import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDonationDto } from '@optimistic-tanuki/models';
import { DonationEntity } from './entities/donation.entity';

@Injectable()
export class DonationsService {
  constructor(
    @InjectRepository(DonationEntity)
    private readonly donationRepository: Repository<DonationEntity>
  ) {}

  async create(createDonationDto: CreateDonationDto): Promise<DonationEntity> {
    const donation = this.donationRepository.create({
      ...createDonationDto,
      status: 'pending',
    });
    return this.donationRepository.save(donation);
  }

  async findAll(): Promise<DonationEntity[]> {
    return this.donationRepository.find({
      where: { anonymous: false },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<DonationEntity[]> {
    return this.donationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<DonationEntity> {
    return this.donationRepository.findOne({ where: { id } });
  }
}
