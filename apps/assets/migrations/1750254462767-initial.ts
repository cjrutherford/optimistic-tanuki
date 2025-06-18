import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1750254462767 implements MigrationInterface {
    name = 'Initial1750254462767'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."asset_entity_type_enum" AS ENUM('image', 'video', 'audio', 'document')`);
        await queryRunner.query(`CREATE TYPE "public"."asset_entity_storagestrategy_enum" AS ENUM('local_block_storage', 'remote_block_storage', 'database_storage')`);
        await queryRunner.query(`CREATE TABLE "asset_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" "public"."asset_entity_type_enum" NOT NULL DEFAULT 'image', "storageStrategy" "public"."asset_entity_storagestrategy_enum" NOT NULL DEFAULT 'local_block_storage', "storagePath" character varying NOT NULL, "profileId" character varying NOT NULL, CONSTRAINT "PK_038b7b28b83db2205747ef9912e" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "asset_entity"`);
        await queryRunner.query(`DROP TYPE "public"."asset_entity_storagestrategy_enum"`);
        await queryRunner.query(`DROP TYPE "public"."asset_entity_type_enum"`);
    }

}
