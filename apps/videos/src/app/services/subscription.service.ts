import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateChannelSubscriptionDto } from '@optimistic-tanuki/models';
import { ChannelSubscription } from '../../entities/channel-subscription.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(ChannelSubscription)
    private readonly subscriptionRepository: Repository<ChannelSubscription>
  ) {}

  async subscribe(
    createSubscriptionDto: CreateChannelSubscriptionDto
  ): Promise<ChannelSubscription> {
    const subscription = this.subscriptionRepository.create(
      createSubscriptionDto
    );
    return this.subscriptionRepository.save(subscription);
  }

  async unsubscribe(channelId: string, userId: string): Promise<void> {
    await this.subscriptionRepository.delete({ channelId, userId });
  }

  async findUserSubscriptions(userId: string): Promise<ChannelSubscription[]> {
    return this.subscriptionRepository.find({
      where: { userId },
      relations: ['channel'],
    });
  }

  async findChannelSubscribers(
    channelId: string
  ): Promise<ChannelSubscription[]> {
    return this.subscriptionRepository.find({
      where: { channelId },
    });
  }

  async isSubscribed(channelId: string, userId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { channelId, userId },
    });
    return !!subscription;
  }
}
