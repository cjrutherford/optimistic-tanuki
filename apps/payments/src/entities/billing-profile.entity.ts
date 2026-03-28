import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('billing_profiles')
@Index(['appScope', 'userId'], { unique: true })
@Index(['appScope'])
@Index(['userId'])
export class BillingProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid', nullable: true })
    profileId: string;

    @Column({ type: 'varchar' })
    appScope: string;

    @Column({ type: 'varchar', nullable: true })
    externalProvider: string;

    @Column({ type: 'varchar', nullable: true })
    externalCustomerId: string;

    @Column({ type: 'varchar', nullable: true })
    email: string;

    @Column({ type: 'varchar', nullable: true })
    name: string;

    @Column({ type: 'varchar', nullable: true })
    defaultPaymentMethodId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}