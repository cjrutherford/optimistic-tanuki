import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from '@optimistic-tanuki/models';
import { SubscriptionEntity } from './entities/subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>
  ) {}

  async create(createSubscriptionDto: CreateSubscriptionDto): Promise<SubscriptionEntity> {
    const subscription = this.subscriptionRepository.create({
      ...createSubscriptionDto,
      status: 'active',
      startDate: createSubscriptionDto.startDate || new Date(),
      nextBillingDate: this.calculateNextBillingDate(
        createSubscriptionDto.interval,
        createSubscriptionDto.startDate || new Date()
      ),
    });
    return this.subscriptionRepository.save(subscription);
  }

  async findAll(): Promise<SubscriptionEntity[]> {
    return this.subscriptionRepository.find({ relations: ['product'] });
  }

  async findByUser(userId: string): Promise<SubscriptionEntity[]> {
    return this.subscriptionRepository.find({
      where: { userId },
      relations: ['product'],
    });
  }

  async findOne(id: string): Promise<SubscriptionEntity> {
    return this.subscriptionRepository.findOne({
      where: { id },
      relations: ['product'],
    });
  }

  async update(id: string, updateSubscriptionDto: UpdateSubscriptionDto): Promise<SubscriptionEntity> {
    await this.subscriptionRepository.update(id, updateSubscriptionDto);
    return this.findOne(id);
  }

  async cancel(id: string): Promise<SubscriptionEntity> {
    await this.subscriptionRepository.update(id, { status: 'cancelled' });
    return this.findOne(id);
  }

  private calculateNextBillingDate(interval: string, startDate: Date): Date {
    const nextDate = new Date(startDate);
    if (interval === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (interval === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    return nextDate;
  }
}
