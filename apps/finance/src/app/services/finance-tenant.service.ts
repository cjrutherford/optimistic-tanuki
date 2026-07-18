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
import { In, Repository } from 'typeorm';
import { FinanceTenant } from '../../entities/finance-tenant.entity';
import { FinanceTenantMember } from '../../entities/finance-tenant-member.entity';
import { FinanceScope } from './finance-scope';

@Injectable()
export class FinanceTenantService {
  constructor(
    @Inject(getRepositoryToken(FinanceTenant))
    private readonly tenantRepo: Repository<FinanceTenant>,
    @Inject(getRepositoryToken(FinanceTenantMember))
    private readonly tenantMemberRepo: Repository<FinanceTenantMember>
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
          : (response as { message?: string })?.message ?? error.message;
      const errorLabel =
        typeof response === 'string'
          ? error.name
          : (response as { error?: string })?.error ?? error.name;

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

  /**
   * Resolves the tenant a scope should act on. Tries the profile's *owned*
   * tenant(s) first (existing, deterministic oldest-first behavior). If
   * none is owned, falls back to a tenant the profile is an *active
   * member* of — this keeps `resolveTenant` consistent with
   * `assertTenantAccess`'s owner-or-active-member model, so a legitimate
   * non-owner member doesn't get a false 404 from `getCurrentTenant` /
   * `listMembers` / the create-fallback in `withResolvedTenant` after
   * having already passed the tenant-access chokepoint.
   */
  private async resolveTenant(scope: FinanceScope): Promise<FinanceTenant> {
    const ownedTenant = await this.tenantRepo.findOne({
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

    if (ownedTenant) {
      return ownedTenant;
    }

    if (scope.profileId) {
      const memberTenant = await this.resolveMemberTenant(scope);
      if (memberTenant) {
        return memberTenant;
      }
    }

    throw new NotFoundException('Active finance tenant not found');
  }

  private async resolveMemberTenant(
    scope: FinanceScope
  ): Promise<FinanceTenant | null> {
    const memberships =
      (await this.tenantMemberRepo.find({
        where: {
          profileId: scope.profileId,
          isActive: true,
          ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
        },
      })) ?? [];

    if (!memberships.length) {
      return null;
    }

    const tenantIds = memberships.map((membership) => membership.tenantId);

    return this.tenantRepo.findOne({
      where: {
        id: In(tenantIds),
        ...(scope.appScope ? { appScope: scope.appScope } : {}),
        isActive: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Verifies that a profile is allowed to act within a given finance
   * tenant, either because it owns the tenant or because it holds an
   * active membership on it. This is the server-side chokepoint that
   * closes the cross-tenant hole left open by trusting the client-supplied
   * `x-finance-tenant-id` header: every handler that resolves a scope with
   * both a tenantId and a profileId must call this before using the scope.
   *
   * A nonexistent tenant and a tenant the profile has no relationship to
   * are treated identically (404), so the response never confirms whether
   * a given tenant id exists to a caller who has no access to it.
   */
  async assertTenantAccess(profileId: string, tenantId: string): Promise<void> {
    try {
      const [ownedTenant, membership] = await Promise.all([
        this.tenantRepo.findOne({
          where: { id: tenantId, profileId, isActive: true },
        }),
        this.tenantMemberRepo.findOne({
          where: { tenantId, profileId, isActive: true },
        }),
      ]);

      if (!ownedTenant && !membership) {
        throw new NotFoundException(
          'Finance tenant not found or access denied'
        );
      }
    } catch (error) {
      throw this.toRpcException(error);
    }
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
          'Profile is required to create a finance tenant'
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
      const tenants = await this.tenantRepo.find({
        where: {
          ...(scope.profileId ? { profileId: scope.profileId } : {}),
          ...(scope.appScope ? { appScope: scope.appScope } : {}),
          isActive: true,
        },
        order: {
          createdAt: 'ASC',
        },
      });

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
