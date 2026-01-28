import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAppScope1769391651163 implements MigrationInterface {
    name = 'AddAppScope1769391651163'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachment" ADD "appScope" character varying NOT NULL DEFAULT 'social'`);
        await queryRunner.query(`ALTER TABLE "vote" ADD "appScope" character varying NOT NULL DEFAULT 'social'`);
        await queryRunner.query(`ALTER TABLE "comment" ADD "appScope" character varying NOT NULL DEFAULT 'social'`);
        await queryRunner.query(`ALTER TABLE "link" ADD "appScope" character varying NOT NULL DEFAULT 'social'`);
        await queryRunner.query(`ALTER TABLE "follow_entity" ADD "appScope" character varying NOT NULL DEFAULT 'social'`);
        await queryRunner.query(`ALTER TABLE "post" ADD "appScope" character varying NOT NULL DEFAULT 'social'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "follow_entity" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "link" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "vote" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "attachment" DROP COLUMN "appScope"`);
    }

}
