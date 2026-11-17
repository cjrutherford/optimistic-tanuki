import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1793840750025 implements MigrationInterface {
    name = 'DirectoryFoundation1793840750025'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_installation" ADD "recoveryEpoch" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_installation" DROP COLUMN "recoveryEpoch"`);
    }

}
