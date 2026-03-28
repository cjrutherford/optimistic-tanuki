import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('saved_payment_methods')
@Index(['appScope'])
@Index(['appScope', 'userId'])
@Index(['appScope', 'externalPaymentMethodId'], { unique: true })
export class SavedPaymentMethod {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: true })
    billingProfileId: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'varchar' })
    appScope: string;

    @Column({ type: 'varchar', nullable: true })
    externalProvider: string;

    @Column({ type: 'varchar', nullable: true })
    externalCustomerId: string;

    @Column({ type: 'varchar', nullable: true })
    externalPaymentMethodId: string;

    @Column({ type: 'varchar', nullable: true })
    brand: string;

    @Column({ type: 'varchar', nullable: true })
    last4: string;

    @Column({ type: 'int', nullable: true })
    expiryMonth: number;

    @Column({ type: 'int', nullable: true })
    expiryYear: number;

    @Column({ type: 'boolean', default: false })
    isDefault: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}