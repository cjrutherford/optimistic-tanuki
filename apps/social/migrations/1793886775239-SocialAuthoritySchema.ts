import { MigrationInterface, QueryRunner } from "typeorm";

export class SocialAuthoritySchema1793886775239 implements MigrationInterface {
    name = 'SocialAuthoritySchema1793886775239'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" ADD "activationId" uuid`);
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" ADD "owner" uuid`);
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" ADD "socialGeneration" bigint NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" ADD "directoryGeneration" bigint`);
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" ADD "phase" character varying NOT NULL DEFAULT 'fenced'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" DROP COLUMN "phase"`);
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" DROP COLUMN "directoryGeneration"`);
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" DROP COLUMN "socialGeneration"`);
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" DROP COLUMN "owner"`);
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" DROP COLUMN "activationId"`);
    }

}
