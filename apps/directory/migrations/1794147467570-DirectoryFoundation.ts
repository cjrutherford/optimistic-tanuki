import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794147467570 implements MigrationInterface {
    name = 'DirectoryFoundation1794147467570'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_reviewed_geometry" ("communityId" uuid NOT NULL, "requestId" uuid NOT NULL, "version" integer NOT NULL, "changeToken" uuid NOT NULL, "geographyHash" character varying(64) NOT NULL, "geometryHash" character varying(64) NOT NULL, "recoveryEpoch" uuid NOT NULL, "directoryGeneration" bigint NOT NULL, CONSTRAINT "PK_76730d7d6a70f83b77e037f8a2c" PRIMARY KEY ("communityId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "directory_reviewed_geometry"`);
    }

}
