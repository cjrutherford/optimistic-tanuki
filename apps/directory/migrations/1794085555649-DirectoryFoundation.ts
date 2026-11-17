import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794085555649 implements MigrationInterface {
    name = 'DirectoryFoundation1794085555649'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_boundary_candidate" ("communityId" uuid NOT NULL, "sourceEpoch" uuid NOT NULL, "activationId" uuid NOT NULL, "socialGeneration" bigint NOT NULL, "changeToken" uuid NOT NULL, "geoid" character varying(10) NOT NULL, "layer" character varying(6) NOT NULL, "vintage" character varying(4) NOT NULL, "stateFips" character varying(2) NOT NULL, "archiveSha256" character varying(64) NOT NULL, CONSTRAINT "PK_41bcfa4945a83dbd4e1a742227a" PRIMARY KEY ("communityId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "directory_boundary_candidate"`);
    }

}
