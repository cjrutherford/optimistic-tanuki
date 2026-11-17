import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1793842298404 implements MigrationInterface {
    name = 'DirectoryFoundation1793842298404'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_census_progress" ADD "sourceEpoch" uuid`);
        await queryRunner.query(`ALTER TABLE "directory_census_progress" ADD "recoveryEpoch" uuid`);
        await queryRunner.query(`ALTER TABLE "directory_census_progress" ADD "owner" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_census_progress" DROP COLUMN "owner"`);
        await queryRunner.query(`ALTER TABLE "directory_census_progress" DROP COLUMN "recoveryEpoch"`);
        await queryRunner.query(`ALTER TABLE "directory_census_progress" DROP COLUMN "sourceEpoch"`);
    }

}
