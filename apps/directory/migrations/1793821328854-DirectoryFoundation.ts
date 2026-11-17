import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1793821328854 implements MigrationInterface {
    name = 'DirectoryFoundation1793821328854'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_census_progress" ("id" character varying(32) NOT NULL, "phase" character varying(16) NOT NULL, "cursor" uuid, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b32dcb0d5d5f5f01e9f670f04fd" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "directory_census_progress"`);
    }

}
