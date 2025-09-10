import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { RiskImpact, RiskLikelihood, RiskResolution, RiskStatus } from '@optimistic-tanuki/models'

import { Project } from "./project.entity";

@Entity()
export class Risk {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Project, (project) => project.risks)
    project: Project;

    @Column()
    description: string;

    @Column({ type: "enum", enum: RiskImpact, default: RiskImpact.MEDIUM })
    impact: RiskImpact;

    @Column({ type: "enum", enum: RiskLikelihood, default: RiskLikelihood.UNKNOWN })
    likelihood: RiskLikelihood;

    @Column({ type: "enum", enum: RiskStatus, default: RiskStatus.OPEN })
    status: RiskStatus;

    @Column({ type: "enum", enum: RiskResolution, default: RiskResolution.PENDING })
    resolution: RiskResolution;

    @Column()
    createdBy: string;

    @Column()
    createdAt: Date;

    @Column()
    updatedBy: string;

    @Column()
    updatedAt: Date;

    @Column({ nullable: true })
    deletedBy?: string;

    @Column({ type: 'timestamp', nullable: true })
    deletedAt: Date;

    @Column({ nullable: true })
    mitigationPlan?: string;

    @Column()
    riskOwner: string; // manual reference to the User Profile Entity from the [Profile Service] representing the owner of the risk
}
