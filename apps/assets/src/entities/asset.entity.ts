import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum StorageStrategy {
    LOCAL_BLOCK_STORAGE = 'local_block_storage',
    REMOTE_BLOCK_STORAGE = 'remote_block_storage',
    DATABASE_STORAGE = 'database_storage',
}

@Entity()
export default class AssetEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ type: 'enum', enum: ['image', 'video', 'audio', 'document'], default: 'image' })
    type: 'image' | 'video' | 'audio' | 'document';

    @Column({ type: 'enum', enum: StorageStrategy, default: StorageStrategy.LOCAL_BLOCK_STORAGE })
    storageStrategy: StorageStrategy;

    @Column()
    storagePath: string;

    @Column()
    profileId: string;
}