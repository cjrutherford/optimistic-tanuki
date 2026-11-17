import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794018651461 implements MigrationInterface {
    name = 'DirectoryFoundation1794018651461'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_overture_private_revocation" ("scanId" character varying(64) NOT NULL, CONSTRAINT "PK_ae53aea122213a4c22a4eb27feb" PRIMARY KEY ("scanId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "directory_overture_private_revocation"`);
    }

}
