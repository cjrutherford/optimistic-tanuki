import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1793928614977 implements MigrationInterface {
    name = 'DirectoryFoundation1793928614977'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_census_progress" ADD "protocol" character varying(32) NOT NULL DEFAULT 'legacy'`);
        await queryRunner.query(`ALTER TABLE "directory_census_progress" ADD "registerRequest" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_census_progress" DROP COLUMN "registerRequest"`);
        await queryRunner.query(`ALTER TABLE "directory_census_progress" DROP COLUMN "protocol"`);
    }

}
