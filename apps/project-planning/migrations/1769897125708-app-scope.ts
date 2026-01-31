import { MigrationInterface, QueryRunner } from "typeorm";

export class AppScope1769897125708 implements MigrationInterface {
    name = 'AppScope1769897125708'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "change" ADD "appScope" character varying NOT NULL DEFAULT 'project-planning'`);
        await queryRunner.query(`ALTER TABLE "project_journal" ADD "appScope" character varying NOT NULL DEFAULT 'project-planning'`);
        await queryRunner.query(`ALTER TABLE "risk" ADD "appScope" character varying NOT NULL DEFAULT 'project-planning'`);
        await queryRunner.query(`ALTER TABLE "timer" ADD "appScope" character varying NOT NULL DEFAULT 'project-planning'`);
        await queryRunner.query(`ALTER TABLE "task" ADD "appScope" character varying NOT NULL DEFAULT 'project-planning'`);
        await queryRunner.query(`ALTER TABLE "project" ADD "appScope" character varying NOT NULL DEFAULT 'project-planning'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "timer" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "risk" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "project_journal" DROP COLUMN "appScope"`);
        await queryRunner.query(`ALTER TABLE "change" DROP COLUMN "appScope"`);
    }

}
