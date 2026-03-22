import { MigrationInterface, QueryRunner } from "typeorm";

export class SystemCommunity1774047250266 implements MigrationInterface {
    name = 'SystemCommunity1774047250266'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community" ADD "isSystemCommunity" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "managerId"`);
        await queryRunner.query(`ALTER TABLE "community" ADD "managerId" character varying`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "managerProfileId"`);
        await queryRunner.query(`ALTER TABLE "community" ADD "managerProfileId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "managerProfileId"`);
        await queryRunner.query(`ALTER TABLE "community" ADD "managerProfileId" uuid`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "managerId"`);
        await queryRunner.query(`ALTER TABLE "community" ADD "managerId" uuid`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "isSystemCommunity"`);
    }

}
