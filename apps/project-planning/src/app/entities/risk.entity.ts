import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Project } from "./project.entity";

@Entity()
export class Risk {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Project, (project) => project.risks)
    project: Project;

    @Column()
    description: string;

    @Column()
    impact: string;

    @Column()
    likelihood: string;

    @Column()
    status: string;

    @Column()
    createdBy: string;

    @Column()
    createdAt: Date;

    @Column()
    updatedBy: string;

    @Column()
    updatedAt: Date;

    @Column()
    deletedBy: string;

    @Column()
    deletedAt: Date;

    @Column()
    mitigationPlan: string;

    @Column()
    riskOwner: string; // manual reference to the User Profile Entity from the [Profile Service] representing the owner of the risk
}
