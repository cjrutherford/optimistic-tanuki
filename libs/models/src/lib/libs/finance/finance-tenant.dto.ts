import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const FINANCE_TENANT_TYPES = [
  'individual',
  'business',
  'nonprofit',
  'household',
] as const;

export type FinanceTenantType = (typeof FINANCE_TENANT_TYPES)[number];

export class CreateFinanceTenantDto {
  @ApiProperty({ description: 'The account name shown to the user' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description:
      'The account type used across onboarding and account switching',
    enum: FINANCE_TENANT_TYPES,
    required: false,
  })
  @IsString()
  @IsIn(FINANCE_TENANT_TYPES)
  @IsOptional()
  type?: FinanceTenantType;

  @ApiProperty({ description: 'The ID of the active profile', required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  profileId?: string;

  @ApiProperty({
    description: 'App scope for the finance tenant',
    required: false,
  })
  @IsString()
  @IsOptional()
  appScope?: string;
}

export interface FinanceTenantDto {
  id: string;
  name: string;
  profileId: string;
  appScope: string;
  type?: FinanceTenantType;
}

export interface FinanceTenantMemberDto {
  id: string;
  tenantId: string;
  profileId: string;
  role: string;
}
