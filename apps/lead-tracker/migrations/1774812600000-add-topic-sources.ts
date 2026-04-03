import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTopicSources1774812600000 implements MigrationInterface {
    name = 'AddTopicSources1774812600000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "lead_topics" ADD "sources" text array NOT NULL DEFAULT '{upwork,linkedin,referral,cold,local,other}'`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead_topics" DROP COLUMN "sources"`);
    }
}