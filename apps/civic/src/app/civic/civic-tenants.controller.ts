import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CIVIC_GET_TENANTS,
  CIVIC_REGISTER_TENANT,
} from '@optimistic-tanuki/constants';
import {
  CivicTenantsService,
  type RegisterCivicTenantDto,
} from './civic-tenants.service';

@Controller()
export class CivicTenantsController {
  constructor(private readonly tenants: CivicTenantsService) {}

  @MessagePattern(CIVIC_GET_TENANTS)
  getTenants() {
    return this.tenants.list();
  }

  @MessagePattern(CIVIC_REGISTER_TENANT)
  registerTenant(@Payload() payload: RegisterCivicTenantDto) {
    return this.tenants.register(payload);
  }
}
