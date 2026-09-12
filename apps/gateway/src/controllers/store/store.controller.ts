import {
  Body,
  Controller,
  Delete,
  BadRequestException,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProductCommands,
  CatalogCommands,
  SubscriptionCommands,
  DonationCommands,
  OrderCommands,
  AppointmentCommands,
  AvailabilityCommands,
  ResourceCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateSubscriptionDto,
  CreateDonationDto,
  CreateOrderDto,
  UpdateOrderDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ApproveAppointmentDto,
  DenyAppointmentDto,
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
  CreateResourceDto,
  UpdateResourceDto,
  CreateStoreCatalogDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { AuthGuard } from '../../auth/auth.guard';
import { WorkspaceContext } from '../../decorators/workspace-context.decorator';
import { WorkspaceContextGuard } from '../../guards/workspace-context.guard';

@Controller('store')
export class StoreController {
  constructor(
    @Inject(ServiceTokens.STORE_SERVICE)
    private readonly storeService: ClientProxy
  ) {}

  private catalogScope(request: any) {
    const workspace = request.workspaceContext?.workspace;
    if (!workspace) {
      throw new BadRequestException('A resolved workspace is required');
    }
    return {
      ownerId: workspace.ownerProfileId,
      workspaceId: workspace.workspaceId,
      appScope: workspace.appScope,
    };
  }

  private productScope(request: any) {
    return this.catalogScope(request);
  }

  private async assertCatalogBelongsToWorkspace(
    catalogId: string,
    request: any
  ): Promise<void> {
    const catalogs = await firstValueFrom(
      this.storeService.send(
        CatalogCommands.FIND_STORE_CATALOGS,
        this.catalogScope(request)
      )
    );

    if (!catalogs.some((catalog: { id: string }) => catalog.id === catalogId)) {
      throw new BadRequestException(
        'The selected catalog does not belong to the resolved workspace'
      );
    }
  }

  @RequirePermissions('store.product.view')
  @WorkspaceContext({
    kind: 'business-site',
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @Get('catalogs/mine')
  async findMyCatalogs(@Req() request: any) {
    return firstValueFrom(
      this.storeService.send(
        CatalogCommands.FIND_STORE_CATALOGS,
        this.catalogScope(request)
      )
    );
  }

  @RequirePermissions('store.product.create')
  @WorkspaceContext({
    kind: 'business-site',
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @Post('catalogs')
  async createCatalog(
    @Body() createCatalogDto: CreateStoreCatalogDto,
    @Req() request: any
  ) {
    return firstValueFrom(
      this.storeService.send(CatalogCommands.CREATE_STORE_CATALOG, {
        createCatalogDto,
        scope: this.catalogScope(request),
      })
    );
  }

  // Product endpoints
  @RequirePermissions('store.product.create')
  @WorkspaceContext({
    kind: 'business-site',
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @Post('products')
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @Req() request: any
  ) {
    if (createProductDto.catalogId) {
      await this.assertCatalogBelongsToWorkspace(
        createProductDto.catalogId,
        request
      );
    }
    return await firstValueFrom(
      this.storeService.send(ProductCommands.CREATE_PRODUCT, {
        createProductDto,
        scope: this.productScope(request),
      })
    );
  }

  @Get('products')
  async findAllProducts(@Query('catalogId') catalogId?: string) {
    if (!catalogId?.trim()) {
      throw new BadRequestException(
        'A catalog is required for public product reads'
      );
    }
    return await firstValueFrom(
      this.storeService.send(ProductCommands.FIND_ALL_PRODUCTS, {
        catalogId: catalogId.trim(),
        public: true,
      })
    );
  }

  @RequirePermissions('store.product.view')
  @WorkspaceContext({
    kind: 'business-site',
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @Get('products/owner/:ownerId')
  async findOwnerProducts(
    @Param('ownerId') _ownerId: string,
    @Req() request: any
  ) {
    return await firstValueFrom(
      this.storeService.send(
        ProductCommands.FIND_OWNER_PRODUCTS,
        this.productScope(request)
      )
    );
  }

  @Get('products/:id')
  async findOneProduct(
    @Param('id') id: string,
    @Query('catalogId') catalogId?: string
  ) {
    if (!catalogId?.trim()) {
      throw new BadRequestException(
        'A catalog is required for public product reads'
      );
    }
    return await firstValueFrom(
      this.storeService.send(ProductCommands.FIND_ONE_PRODUCT, {
        id,
        catalogId: catalogId.trim(),
        public: true,
      })
    );
  }

  @RequirePermissions('store.product.update')
  @WorkspaceContext({
    kind: 'business-site',
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @Put('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() request: any
  ) {
    if (updateProductDto.catalogId) {
      await this.assertCatalogBelongsToWorkspace(
        updateProductDto.catalogId,
        request
      );
    }
    return await firstValueFrom(
      this.storeService.send(ProductCommands.UPDATE_PRODUCT, {
        id,
        updateProductDto,
        scope: this.productScope(request),
      })
    );
  }

  @RequirePermissions('store.product.delete')
  @WorkspaceContext({
    kind: 'business-site',
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @Delete('products/:id')
  async removeProduct(@Param('id') id: string, @Req() request: any) {
    return await firstValueFrom(
      this.storeService.send(ProductCommands.REMOVE_PRODUCT, {
        id,
        scope: this.productScope(request),
      })
    );
  }

  // Donation endpoints
  @Post('donations')
  async createDonation(@Body() createDonationDto: CreateDonationDto) {
    return await firstValueFrom(
      this.storeService.send(
        DonationCommands.CREATE_DONATION,
        createDonationDto
      )
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

  @RequirePermissions('store.order.view')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('orders')
  async findAllOrders() {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.FIND_ALL_ORDERS, {})
    );
  }

  @RequirePermissions('store.order.view')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('orders/:id')
  async findOneOrder(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.FIND_ONE_ORDER, id)
    );
  }

  @UseGuards(AuthGuard)
  @Get('orders/user/:userId')
  async findUserOrders(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.FIND_USER_ORDERS, userId)
    );
  }

  @RequirePermissions('store.order.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('orders/:id')
  async updateOrder(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto
  ) {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.UPDATE_ORDER, {
        id,
        updateOrderDto,
      })
    );
  }

  // Subscription endpoints
  @RequirePermissions('store.subscription.view')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('subscriptions')
  async findAllSubscriptions() {
    return await firstValueFrom(
      this.storeService.send(SubscriptionCommands.FIND_ALL_SUBSCRIPTIONS, {})
    );
  }

  @UseGuards(AuthGuard)
  @Post('subscriptions')
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto
  ) {
    return await firstValueFrom(
      this.storeService.send(
        SubscriptionCommands.CREATE_SUBSCRIPTION,
        createSubscriptionDto
      )
    );
  }

  @UseGuards(AuthGuard)
  @Get('subscriptions/user/:userId')
  async findUserSubscriptions(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.storeService.send(
        SubscriptionCommands.FIND_USER_SUBSCRIPTIONS,
        userId
      )
    );
  }

  @RequirePermissions('store.subscription.cancel')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('subscriptions/:id/cancel')
  async cancelSubscription(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(SubscriptionCommands.CANCEL_SUBSCRIPTION, id)
    );
  }

  // Appointment endpoints
  @UseGuards(AuthGuard)
  @Post('appointments')
  async createAppointment(@Body() createAppointmentDto: CreateAppointmentDto) {
    return await firstValueFrom(
      this.storeService.send(
        AppointmentCommands.CREATE_APPOINTMENT,
        createAppointmentDto
      )
    );
  }

  @RequirePermissions('store.appointment.view')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('appointments')
  async findAllAppointments() {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_ALL_APPOINTMENTS, {})
    );
  }

  @UseGuards(AuthGuard)
  @Get('appointments/user/:userId')
  async findUserAppointments(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_USER_APPOINTMENTS, userId)
    );
  }

  @UseGuards(AuthGuard)
  @Get('appointments/:id')
  async findOneAppointment(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_ONE_APPOINTMENT, id)
    );
  }

  @UseGuards(AuthGuard)
  @Put('appointments/:id')
  async updateAppointment(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto
  ) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.UPDATE_APPOINTMENT, {
        id,
        updateAppointmentDto,
      })
    );
  }

  @RequirePermissions('store.appointment.approve')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('appointments/:id/approve')
  async approveAppointment(
    @Param('id') id: string,
    @Body() approveAppointmentDto: ApproveAppointmentDto
  ) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.APPROVE_APPOINTMENT, {
        id,
        approveAppointmentDto,
      })
    );
  }

  @RequirePermissions('store.appointment.deny')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('appointments/:id/deny')
  async denyAppointment(
    @Param('id') id: string,
    @Body() denyAppointmentDto: DenyAppointmentDto
  ) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.DENY_APPOINTMENT, {
        id,
        denyAppointmentDto,
      })
    );
  }

  @RequirePermissions('store.appointment.cancel')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('appointments/:id/cancel')
  async cancelAppointment(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.CANCEL_APPOINTMENT, id)
    );
  }

  @RequirePermissions('store.appointment.complete')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('appointments/:id/complete')
  async completeAppointment(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.COMPLETE_APPOINTMENT, id)
    );
  }

  @RequirePermissions('store.appointment.invoice')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('appointments/:id/invoice')
  async generateInvoice(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.GENERATE_INVOICE, id)
    );
  }

  // Availability endpoints
  @RequirePermissions('store.availability.create')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('availabilities')
  async createAvailability(
    @Body() createAvailabilityDto: CreateAvailabilityDto
  ) {
    return await firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.CREATE_AVAILABILITY,
        createAvailabilityDto
      )
    );
  }

  @Get('availabilities')
  async findAllAvailabilities() {
    return await firstValueFrom(
      this.storeService.send(AvailabilityCommands.FIND_ALL_AVAILABILITIES, {})
    );
  }

  @Get('availabilities/owner/:ownerId')
  async findOwnerAvailabilities(@Param('ownerId') ownerId: string) {
    return await firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.FIND_OWNER_AVAILABILITIES,
        ownerId
      )
    );
  }

  @Get('availabilities/:id')
  async findOneAvailability(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AvailabilityCommands.FIND_ONE_AVAILABILITY, id)
    );
  }

  @RequirePermissions('store.availability.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('availabilities/:id')
  async updateAvailability(
    @Param('id') id: string,
    @Body() updateAvailabilityDto: UpdateAvailabilityDto
  ) {
    return await firstValueFrom(
      this.storeService.send(AvailabilityCommands.UPDATE_AVAILABILITY, {
        id,
        updateAvailabilityDto,
      })
    );
  }

  @RequirePermissions('store.availability.delete')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Delete('availabilities/:id')
  async removeAvailability(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AvailabilityCommands.REMOVE_AVAILABILITY, id)
    );
  }

  // Resource endpoints
  @RequirePermissions('store.resource.create')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('resources')
  async createResource(@Body() createResourceDto: CreateResourceDto) {
    return await firstValueFrom(
      this.storeService.send(
        ResourceCommands.CREATE_RESOURCE,
        createResourceDto
      )
    );
  }

  @Get('resources')
  async findAllResources() {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.FIND_ALL_RESOURCES, {})
    );
  }

  @Get('resources/type/:type')
  async findResourcesByType(@Param('type') type: string) {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.FIND_RESOURCES_BY_TYPE, type)
    );
  }

  @Get('resources/:id')
  async findOneResource(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.FIND_ONE_RESOURCE, id)
    );
  }

  @RequirePermissions('store.resource.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('resources/:id')
  async updateResource(
    @Param('id') id: string,
    @Body() updateResourceDto: UpdateResourceDto
  ) {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.UPDATE_RESOURCE, {
        id,
        updateResourceDto,
      })
    );
  }

  @RequirePermissions('store.resource.delete')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Delete('resources/:id')
  async removeResource(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.REMOVE_RESOURCE, id)
    );
  }

  @Post('resources/:id/check-availability')
  async checkResourceAvailability(
    @Param('id') resourceId: string,
    @Body() data: { startTime: Date; endTime: Date }
  ) {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.CHECK_RESOURCE_AVAILABILITY, {
        resourceId,
        ...data,
      })
    );
  }
}
