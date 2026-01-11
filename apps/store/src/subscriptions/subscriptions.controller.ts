import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from '@optimistic-tanuki/models';

@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @MessagePattern({ cmd: 'createSubscription' })
  create(@Payload() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(createSubscriptionDto);
  }

  @MessagePattern({ cmd: 'findAllSubscriptions' })
  findAll() {
    return this.subscriptionsService.findAll();
  }

  @MessagePattern({ cmd: 'findUserSubscriptions' })
  findUserSubscriptions(@Payload() userId: string) {
    return this.subscriptionsService.findByUser(userId);
  }

  @MessagePattern({ cmd: 'findOneSubscription' })
  findOne(@Payload() id: string) {
    return this.subscriptionsService.findOne(id);
  }

  @MessagePattern({ cmd: 'updateSubscription' })
  update(@Payload() data: { id: string; updateSubscriptionDto: UpdateSubscriptionDto }) {
    return this.subscriptionsService.update(data.id, data.updateSubscriptionDto);
  }

  @MessagePattern({ cmd: 'cancelSubscription' })
  cancel(@Payload() id: string) {
    return this.subscriptionsService.cancel(id);
  }
}
