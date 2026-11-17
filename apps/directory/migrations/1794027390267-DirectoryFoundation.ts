import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794027390267 implements MigrationInterface {
    name = 'DirectoryFoundation1794027390267'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_overture_private_checkpoint" DROP CONSTRAINT "PK_d5855fa955621aef4d1a2e00343"`);
        await queryRunner.query(`ALTER TABLE "directory_overture_private_checkpoint" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "directory_overture_private_checkpoint" ADD CONSTRAINT "PK_d5a38620d93e9b03379c5abc4f3" PRIMARY KEY ("scanId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_overture_private_checkpoint" DROP CONSTRAINT "PK_d5a38620d93e9b03379c5abc4f3"`);
        await queryRunner.query(`ALTER TABLE "directory_overture_private_checkpoint" ADD "id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "directory_overture_private_checkpoint" ADD CONSTRAINT "PK_d5855fa955621aef4d1a2e00343" PRIMARY KEY ("id")`);
    }

}
