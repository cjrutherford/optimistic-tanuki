import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SubscriptionCommands } from '@optimistic-tanuki/constants';
import { SubscriptionsService } from './subscriptions.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from '@optimistic-tanuki/models';

@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @MessagePattern(SubscriptionCommands.CREATE_SUBSCRIPTION)
  create(@Payload() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(createSubscriptionDto);
  }

  @MessagePattern(SubscriptionCommands.FIND_ALL_SUBSCRIPTIONS)
  findAll() {
    return this.subscriptionsService.findAll();
  }

  @MessagePattern(SubscriptionCommands.FIND_USER_SUBSCRIPTIONS)
  findUserSubscriptions(@Payload() userId: string) {
    return this.subscriptionsService.findByUser(userId);
  }

  @MessagePattern(SubscriptionCommands.FIND_ONE_SUBSCRIPTION)
  findOne(@Payload() id: string) {
    return this.subscriptionsService.findOne(id);
  }

  @MessagePattern(SubscriptionCommands.UPDATE_SUBSCRIPTION)
  update(
    @Payload()
    data: {
      id: string;
      updateSubscriptionDto: UpdateSubscriptionDto;
    }
  ) {
    return this.subscriptionsService.update(
      data.id,
      data.updateSubscriptionDto
    );
  }

  @MessagePattern(SubscriptionCommands.CANCEL_SUBSCRIPTION)
  cancel(@Payload() id: string) {
    return this.subscriptionsService.cancel(id);
  }
}
