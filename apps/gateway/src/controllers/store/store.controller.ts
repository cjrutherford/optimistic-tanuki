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
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ProductCommands,
  CatalogCommands,
  SubscriptionCommands,
  OrderCommands,
  AppointmentCommands,
  AvailabilityCommands,
  ResourceCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { BillingCommands } from '@optimistic-tanuki/billing-contracts';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateSubscriptionDto,
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
import { AppScope } from '../../decorators/appscope.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { WorkspaceContext } from '../../decorators/workspace-context.decorator';
import { WorkspaceContextGuard } from '../../guards/workspace-context.guard';

@ApiTags('store')
@Controller('store')
export class StoreController {
  constructor(
    @Inject(ServiceTokens.STORE_SERVICE)
    private readonly storeService: ClientProxy,
    @Inject(ServiceTokens.BILLING_SERVICE)
    private readonly billingService: ClientProxy
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
  @ApiOperation({ summary: 'List catalogs in the resolved workspace' })
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
  @ApiOperation({ summary: 'Create a store catalog' })
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
  @ApiOperation({ summary: 'Create a product' })
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
  @ApiOperation({ summary: 'List public products in a catalog' })
  @ApiQuery({ name: 'catalogId', required: false })
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
  @ApiOperation({ summary: 'List workspace products for an owner' })
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
  @ApiOperation({ summary: 'Get one public product' })
  @ApiQuery({ name: 'catalogId', required: false })
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
  @ApiOperation({ summary: 'Update a product' })
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
  @ApiOperation({ summary: 'Delete a product' })
  @Delete('products/:id')
  async removeProduct(@Param('id') id: string, @Req() request: any) {
    return await firstValueFrom(
      this.storeService.send(ProductCommands.REMOVE_PRODUCT, {
        id,
        scope: this.productScope(request),
      })
    );
  }

  // Order endpoints
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create an order' })
  @Post('orders')
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.CREATE_ORDER, createOrderDto)
    );
  }

  @RequirePermissions('store.order.view')
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List all orders' })
  @Get('orders')
  async findAllOrders() {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.FIND_ALL_ORDERS, {})
    );
  }

  @RequirePermissions('store.order.view')
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get one order' })
  @Get('orders/:id')
  async findOneOrder(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.FIND_ONE_ORDER, id)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List orders for a user' })
  @Get('orders/user/:userId')
  async findUserOrders(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.storeService.send(OrderCommands.FIND_USER_ORDERS, userId)
    );
  }

  @RequirePermissions('store.order.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update an order' })
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
  @ApiOperation({ summary: 'List all subscriptions' })
  @Get('subscriptions')
  async findAllSubscriptions() {
    return await firstValueFrom(
      this.storeService.send(SubscriptionCommands.FIND_ALL_SUBSCRIPTIONS, {})
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a subscription (billing canonical first)' })
  @Post('subscriptions')
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ) {
    // E7 dual-write: the canonical billing subscription is created first
    // (plan resolved inside billing), then the store entitlement mirror with
    // the returned id. Reads stay on the mirror (FIND_* untouched).
    // tenantId/accountId fall back to the caller until finance account
    // provisioning exists (documented limitation, same as E5 receipts).
    const subscription = (await firstValueFrom(
      this.billingService.send(
        { cmd: BillingCommands.SUBSCRIPTION_CREATE_FROM_PRODUCT },
        {
          tenantId: user?.userId ?? createSubscriptionDto.userId,
          appScope: appScope || 'store',
          accountId: createSubscriptionDto.userId,
          productId: createSubscriptionDto.productId,
          interval: (createSubscriptionDto as { interval?: string }).interval,
        }
      )
    )) as { id: string };
    return await firstValueFrom(
      this.storeService.send(SubscriptionCommands.CREATE_SUBSCRIPTION, {
        ...createSubscriptionDto,
        billingSubscriptionId: subscription.id,
      })
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List subscriptions for a user' })
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
  @ApiOperation({ summary: 'Cancel a subscription (billing canonical first)' })
  @Put('subscriptions/:id/cancel')
  async cancelSubscription(@Param('id') id: string) {
    // E7: canonical cancel in billing first (looked up via the mirror row),
    // then mirror the terminal state. Legacy rows without a reference skip
    // the billing hop. Reads stay on the mirror.
    const entitlement = (await firstValueFrom(
      this.storeService.send(SubscriptionCommands.FIND_ONE_SUBSCRIPTION, id)
    )) as { billingSubscriptionId?: string } | null;
    if (entitlement?.billingSubscriptionId) {
      await firstValueFrom(
        this.billingService.send(
          { cmd: BillingCommands.SUBSCRIPTION_CANCEL },
          { id: entitlement.billingSubscriptionId }
        )
      );
    }
    return await firstValueFrom(
      this.storeService.send(SubscriptionCommands.CANCEL_SUBSCRIPTION, id)
    );
  }

  // Appointment endpoints
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create an appointment' })
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
  @ApiOperation({ summary: 'List all appointments' })
  @Get('appointments')
  async findAllAppointments() {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_ALL_APPOINTMENTS, {})
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List appointments for a user' })
  @Get('appointments/user/:userId')
  async findUserAppointments(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_USER_APPOINTMENTS, userId)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get one appointment' })
  @Get('appointments/:id')
  async findOneAppointment(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.FIND_ONE_APPOINTMENT, id)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update an appointment' })
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
  @ApiOperation({ summary: 'Approve an appointment' })
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
  @ApiOperation({ summary: 'Deny an appointment' })
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
  @ApiOperation({ summary: 'Cancel an appointment' })
  @Put('appointments/:id/cancel')
  async cancelAppointment(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.CANCEL_APPOINTMENT, id)
    );
  }

  @RequirePermissions('store.appointment.complete')
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Complete an appointment' })
  @Put('appointments/:id/complete')
  async completeAppointment(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.COMPLETE_APPOINTMENT, id)
    );
  }

  @RequirePermissions('store.appointment.invoice')
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Generate an invoice for an appointment' })
  @Post('appointments/:id/invoice')
  async generateInvoice(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AppointmentCommands.GENERATE_INVOICE, id)
    );
  }

  // Availability endpoints
  @RequirePermissions('store.availability.create')
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create an availability' })
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
  @ApiOperation({ summary: 'List all availabilities' })
  async findAllAvailabilities() {
    return await firstValueFrom(
      this.storeService.send(AvailabilityCommands.FIND_ALL_AVAILABILITIES, {})
    );
  }

  @Get('availabilities/owner/:ownerId')
  @ApiOperation({ summary: 'List availabilities for an owner' })
  async findOwnerAvailabilities(@Param('ownerId') ownerId: string) {
    return await firstValueFrom(
      this.storeService.send(
        AvailabilityCommands.FIND_OWNER_AVAILABILITIES,
        ownerId
      )
    );
  }

  @Get('availabilities/:id')
  @ApiOperation({ summary: 'Get one availability' })
  async findOneAvailability(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AvailabilityCommands.FIND_ONE_AVAILABILITY, id)
    );
  }

  @RequirePermissions('store.availability.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update an availability' })
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
  @ApiOperation({ summary: 'Delete an availability' })
  @Delete('availabilities/:id')
  async removeAvailability(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(AvailabilityCommands.REMOVE_AVAILABILITY, id)
    );
  }

  // Resource endpoints
  @RequirePermissions('store.resource.create')
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create a resource' })
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
  @ApiOperation({ summary: 'List all resources' })
  async findAllResources() {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.FIND_ALL_RESOURCES, {})
    );
  }

  @Get('resources/type/:type')
  @ApiOperation({ summary: 'List resources by type' })
  async findResourcesByType(@Param('type') type: string) {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.FIND_RESOURCES_BY_TYPE, type)
    );
  }

  @Get('resources/:id')
  @ApiOperation({ summary: 'Get one resource' })
  async findOneResource(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.FIND_ONE_RESOURCE, id)
    );
  }

  @RequirePermissions('store.resource.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update a resource' })
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
  @ApiOperation({ summary: 'Delete a resource' })
  @Delete('resources/:id')
  async removeResource(@Param('id') id: string) {
    return await firstValueFrom(
      this.storeService.send(ResourceCommands.REMOVE_RESOURCE, id)
    );
  }

  @Post('resources/:id/check-availability')
  @ApiOperation({ summary: 'Check resource availability for a time range' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' },
      },
      required: ['startTime', 'endTime'],
    },
  })
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
