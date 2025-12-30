import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProductCommands,
  SubscriptionCommands,
  DonationCommands,
  OrderCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CreateDonationDto,
  CreateOrderDto,
  UpdateOrderDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { AuthGuard } from '../../auth/auth.guard';

@Controller('store')
export class StoreController {
  constructor(
    @Inject(ServiceTokens.STORE_SERVICE)
    private readonly storeService: ClientProxy
  ) {}

  // Product endpoints
  @RequirePermissions('store.product.create')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('products')
  async createProduct(@Body() createProductDto: CreateProductDto) {
    return await firstValueFrom(
      this.storeService.send(ProductCommands.CREATE_PRODUCT, createProductDto)
    );
  }

  @Get('products')
  async findAllProducts() {
    return await firstValueFrom(
      this.storeService.send(ProductCommands.FIND_ALL_PRODUCTS, {})
    );
  }

  @Get('products/:id')
  async findOneProduct(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(ProductCommands.FIND_ONE_PRODUCT, id)
    );
  }

  @RequirePermissions('store.product.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto
  ) {
    return await firstValueFrom(
      this.storeService.send(ProductCommands.UPDATE_PRODUCT, {
        id,
        updateProductDto,
      })
    );
  }

  @RequirePermissions('store.product.delete')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Delete('products/:id')
  async removeProduct(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(ProductCommands.REMOVE_PRODUCT, id)
    );
  }

  // Donation endpoints
  @Post('donations')
  async createDonation(@Body() createDonationDto: CreateDonationDto) {
    return await firstValueFrom(
      this.storeService.send(DonationCommands.CREATE_DONATION, createDonationDto)
    );
  }

  @Get('donations')
  async findAllDonations() {
    return await firstValueFrom(
      this.storeService.send(DonationCommands.FIND_ALL_DONATIONS, {})
    );
  }

  // Order endpoints
  @UseGuards(AuthGuard)
  @Post('orders')
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.CREATE_ORDER, createOrderDto)
    );
  }

  @UseGuards(AuthGuard)
  @Get('orders/user/:userId')
  async findUserOrders(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.FIND_USER_ORDERS, userId)
    );
  }

  // Subscription endpoints
  @UseGuards(AuthGuard)
  @Post('subscriptions')
  async createSubscription(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return await firstValueFrom(
      this.storeService.send(SubscriptionCommands.CREATE_SUBSCRIPTION, createSubscriptionDto)
    );
  }

  @UseGuards(AuthGuard)
  @Get('subscriptions/user/:userId')
  async findUserSubscriptions(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.storeService.send(SubscriptionCommands.FIND_USER_SUBSCRIPTIONS, userId)
    );
  }

  @UseGuards(AuthGuard)
  @Put('subscriptions/:id/cancel')
  async cancelSubscription(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(SubscriptionCommands.CANCEL_SUBSCRIPTION, id)
    );
  }
}
