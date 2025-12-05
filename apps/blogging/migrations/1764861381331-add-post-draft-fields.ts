import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostDraftFields1764861381331 implements MigrationInterface {
    name = 'AddPostDraftFields1764861381331'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "isDraft" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "post" ADD "publishedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "publishedAt"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "isDraft"`);
    }
}
