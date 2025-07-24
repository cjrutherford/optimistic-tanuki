import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RiskImpact {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
}

export enum RiskLikelihood {
    UNLIKELY = "UNLIKELY",
    POSSIBLE = "POSSIBLE",
    LIKELY = "LIKELY",
    IMMINENT = "IMMINENT",
    ALMOST_CERTAIN = "ALMOST_CERTAIN",
    CERTAIN = "CERTAIN",
    NOT_APPLICABLE = "NOT_APPLICABLE", // For risks that are not applicable
    UNKNOWN = "UNKNOWN", // For risks that are unknown or not yet assessed
}

export enum RiskStatus {
    OPEN = "OPEN",
    IN_PROGRESS = "IN_PROGRESS",
    CLOSED = "CLOSED",
}

export enum RiskResolution {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    MITIGATED = "MITIGATED",
    ESCALATED = "ESCALATED",
    AVOIDED = "AVOIDED",
}

export class CreateRiskDto {
    @ApiProperty({ description: 'Manual reference to the User Profile Entity from the [Profile Service] representing owner of the risk' })
    riskOwner: string;

    @ApiProperty({ description: 'Manual reference to the Project Entity from the [Project Planning Service] representing a related party to the risk' })
    projectId: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    description: string;

    @ApiProperty()
    impact: RiskImpact;

    @ApiProperty()
    likelihood: RiskLikelihood;

    @ApiProperty()
    status: RiskStatus;

    @ApiPropertyOptional()
    mitigationPlan?: string;

    @ApiPropertyOptional({ description: 'Optional field for a risk resolution, this is to include it in the update dto as well.'})
    resolution?: RiskResolution;
}
