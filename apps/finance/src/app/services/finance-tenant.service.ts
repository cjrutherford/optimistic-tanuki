import {
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CreateFinanceTenantDto,
  FinanceTenantDto,
  FinanceTenantMemberDto,
} from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { FinanceTenant } from '../../entities/finance-tenant.entity';
import { FinanceTenantMember } from '../../entities/finance-tenant-member.entity';
import { FinanceScope } from './finance-scope';

@Injectable()
export class FinanceTenantService {
  constructor(
    @Inject(getRepositoryToken(FinanceTenant))
    private readonly tenantRepo: Repository<FinanceTenant>,
    @Inject(getRepositoryToken(FinanceTenantMember))
    private readonly tenantMemberRepo: Repository<FinanceTenantMember>,
  ) {}

  private toRpcException(error: unknown): RpcException {
    if (error instanceof RpcException) {
      return error;
    }

    if (error instanceof HttpException) {
      const response = error.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : Array.isArray((response as { message?: unknown })?.message)
            ? (response as { message: string[] }).message.join(', ')
            : ((response as { message?: string })?.message ?? error.message);
      const errorLabel =
        typeof response === 'string'
          ? error.name
          : ((response as { error?: string })?.error ?? error.name);

      return new RpcException({
        statusCode: error.getStatus(),
        message,
        error: errorLabel,
      });
    }

    const internalError =
      error instanceof Error
        ? new InternalServerErrorException(error.message)
        : new InternalServerErrorException('Unexpected finance service error');

    return this.toRpcException(internalError);
  }

  private toTenantDto(tenant: FinanceTenant): FinanceTenantDto {
    return {
      id: tenant.id,
      name: tenant.name,
      profileId: tenant.profileId,
      appScope: tenant.appScope,
      ...(tenant.type ? { type: tenant.type } : {}),
    };
  }

  private async ensureDefaultTenant(
    scope: FinanceScope,
  ): Promise<FinanceTenant | null> {
    if (!scope.profileId) {
      return null;
    }

    const existingTenant = await this.tenantRepo.findOne({
      where: {
        profileId: scope.profileId,
        ...(scope.appScope ? { appScope: scope.appScope } : {}),
        isActive: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    if (existingTenant) {
      return existingTenant;
    }

    const tenant = await this.tenantRepo.save({
      name: 'Primary Finance Workspace',
      profileId: scope.profileId,
      appScope: scope.appScope ?? 'finance',
      isActive: true,
    });

    await this.tenantMemberRepo.save({
      tenantId: tenant.id,
      profileId: scope.profileId,
      role: 'finance_admin',
      isActive: true,
    });

    return tenant;
  }

  private async resolveTenant(scope: FinanceScope): Promise<FinanceTenant> {
    let tenant = await this.tenantRepo.findOne({
      where: {
        ...(scope.tenantId ? { id: scope.tenantId } : {}),
        ...(scope.profileId ? { profileId: scope.profileId } : {}),
        ...(scope.appScope ? { appScope: scope.appScope } : {}),
        isActive: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    if (!tenant && !scope.tenantId) {
      tenant = await this.ensureDefaultTenant(scope);
    }

    if (!tenant) {
      throw new NotFoundException('Active finance tenant not found');
    }

    return tenant;
  }

  async getCurrentTenant(scope: FinanceScope): Promise<FinanceTenantDto> {
    try {
      const tenant = await this.resolveTenant(scope);

      return this.toTenantDto(tenant);
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  async createTenant(dto: CreateFinanceTenantDto): Promise<FinanceTenantDto> {
    try {
      if (!dto.profileId) {
        throw new NotFoundException(
          'Profile is required to create a finance tenant',
        );
      }

      const tenant = await this.tenantRepo.save({
        name: dto.name,
        profileId: dto.profileId,
        appScope: dto.appScope ?? 'finance',
        type: dto.type ?? 'individual',
        isActive: true,
      });

      await this.tenantMemberRepo.save({
        tenantId: tenant.id,
        profileId: dto.profileId,
        role: 'finance_admin',
        isActive: true,
      });

      return this.toTenantDto(tenant);
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  async listTenants(scope: FinanceScope): Promise<FinanceTenantDto[]> {
    try {
      let tenants = await this.tenantRepo.find({
        where: {
          ...(scope.profileId ? { profileId: scope.profileId } : {}),
          ...(scope.appScope ? { appScope: scope.appScope } : {}),
          isActive: true,
        },
        order: {
          createdAt: 'ASC',
        },
      });

      if (tenants.length === 0) {
        const tenant = await this.ensureDefaultTenant(scope);
        tenants = tenant ? [tenant] : [];
      }

      return tenants.map((tenant) => this.toTenantDto(tenant));
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  async listMembers(scope: FinanceScope): Promise<FinanceTenantMemberDto[]> {
    try {
      const tenant = await this.resolveTenant(scope);
      const members = await this.tenantMemberRepo.find({
        where: {
          tenantId: tenant.id,
          isActive: true,
        },
        order: {
          createdAt: 'ASC',
        },
      });

      return members.map((member) => ({
        id: member.id,
        tenantId: member.tenantId,
        profileId: member.profileId,
        role: member.role,
      }));
    } catch (error) {
      throw this.toRpcException(error);
    }
  }
}
