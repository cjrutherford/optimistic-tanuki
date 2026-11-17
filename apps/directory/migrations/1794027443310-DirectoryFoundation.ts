import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794027443310 implements MigrationInterface {
    name = 'DirectoryFoundation1794027443310'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_overture_private_scan_lock" ("scanId" character varying(64) NOT NULL, CONSTRAINT "PK_52d0cd49c21fc9334e7f50443a6" PRIMARY KEY ("scanId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "directory_overture_private_scan_lock"`);
    }

}
