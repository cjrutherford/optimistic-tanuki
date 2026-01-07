import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { AssetType, StorageStrategy } from '@optimistic-tanuki/models';

@Entity()
export default class AssetEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ type: 'enum', enum: AssetType, default: AssetType.IMAGE })
    type: AssetType;

    @Column({ type: 'enum', enum: StorageStrategy, default: StorageStrategy.LOCAL_BLOCK_STORAGE })
    storageStrategy: StorageStrategy;

    @Column()
    storagePath: string;

    @Column()
    profileId: string;
}