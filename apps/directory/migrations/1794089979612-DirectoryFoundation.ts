import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794089979612 implements MigrationInterface {
    name = 'DirectoryFoundation1794089979612'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_boundary_candidate" ADD "geographyHash" character varying(64) NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_boundary_candidate" DROP COLUMN "geographyHash"`);
    }

}
