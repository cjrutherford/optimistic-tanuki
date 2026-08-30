import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum RiskImpact {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum RiskLikelihood {
  UNLIKELY = 'UNLIKELY',
  POSSIBLE = 'POSSIBLE',
  LIKELY = 'LIKELY',
  IMMINENT = 'IMMINENT',
  ALMOST_CERTAIN = 'ALMOST_CERTAIN',
  CERTAIN = 'CERTAIN',
  NOT_APPLICABLE = 'NOT_APPLICABLE', // For risks that are not applicable
  UNKNOWN = 'UNKNOWN', // For risks that are unknown or not yet assessed
}

export enum RiskStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  CLOSED = 'CLOSED',
}

export enum RiskResolution {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  MITIGATED = 'MITIGATED',
  ESCALATED = 'ESCALATED',
  AVOIDED = 'AVOIDED',
}

export class CreateRiskDto {
  /**
   * Who owns the risk.
   *
   * Optional because the gateway sets it from the session and overwrites
   * whatever arrives. Requiring it meant every client had to send a value that
   * was then discarded, and the clients that forgot simply could not create
   * anything. Identity belongs to the session, never the body.
   */
  @ApiPropertyOptional({ description: 'Set from the session by the gateway' })
  @IsOptional()
  @IsUUID()
  riskOwner?: string;

  @ApiProperty({
    description:
      'Manual reference to the Project Entity from the [Project Planning Service] representing a related party to the risk',
  })
  @IsString()
  @IsUUID()
  projectId!: string;

  /**
   * A short name for the risk.
   *
   * Optional because nothing stores it: the risk table has no name column, and
   * the service uses this only as a fallback when no description was given.
   * Requiring it meant the risk form, which collects a description and no
   * name, could not raise a risk at all.
   */
  @ApiPropertyOptional({ description: 'Short name; falls back to description' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @ApiProperty({ description: 'Description of the risk' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ description: 'Impact level of the risk', enum: RiskImpact })
  @IsEnum(RiskImpact)
  impact!: RiskImpact;

  @ApiProperty({ description: 'Likelihood of the risk', enum: RiskLikelihood })
  @IsEnum(RiskLikelihood)
  likelihood!: RiskLikelihood;

  @ApiProperty({ description: 'Current status of the risk', enum: RiskStatus })
  @IsEnum(RiskStatus)
  status!: RiskStatus;

  @ApiPropertyOptional({ description: 'Mitigation plan for the risk' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  mitigationPlan?: string;

  @ApiPropertyOptional({
    description:
      'Optional field for a risk resolution, this is to include it in the update dto as well.',
    enum: RiskResolution,
  })
  @IsOptional()
  @IsEnum(RiskResolution)
  resolution?: RiskResolution;
}
