import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CivicTenant } from '../entities/civic-tenant.entity';

export interface RegisterCivicTenantDto {
  id: string;
  displayName: string;
  townName: string;
  state: string;
  kind: 'city' | 'town' | 'village' | 'county';
}

const KINDS = new Set(['city', 'town', 'village', 'county']);

/** Which municipalities operate Civic Core, and where they are. */
@Injectable()
export class CivicTenantsService {
  private readonly tenants: Repository<CivicTenant>;

  constructor(@Inject('CIVIC_CONNECTION') dataSource: DataSource) {
    this.tenants = dataSource.getRepository(CivicTenant);
  }

  list(): Promise<CivicTenant[]> {
    return this.tenants.find({ order: { id: 'ASC' } });
  }

  /** Creates or updates a tenant's record. */
  async register(input: RegisterCivicTenantDto): Promise<CivicTenant> {
    const id = input.id?.trim();
    const state = input.state?.trim().toUpperCase();
    if (!id) throw new BadRequestException('tenant id is required');
    if (!input.townName?.trim())
      throw new BadRequestException('townName is required');
    if (!/^[A-Z]{2}$/u.test(state ?? ''))
      throw new BadRequestException('state must be a two-letter code');
    if (!KINDS.has(input.kind))
      throw new BadRequestException(
        'kind must be city, town, village or county'
      );
    return this.tenants.save({
      id,
      displayName: input.displayName?.trim() || input.townName.trim(),
      townName: input.townName.trim(),
      state: state as string,
      kind: input.kind,
    });
  }
}
