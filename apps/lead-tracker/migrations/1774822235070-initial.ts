import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1774822235070 implements MigrationInterface {
    name = 'Initial1774822235070'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead_topic_links" DROP CONSTRAINT "FK_lead_topic_links_lead"`);
        await queryRunner.query(`ALTER TABLE "lead_topic_links" DROP CONSTRAINT "FK_lead_topic_links_topic"`);
        await queryRunner.query(`ALTER TABLE "lead_topic_links" DROP CONSTRAINT "UQ_lead_topic_links_lead_topic"`);
        await queryRunner.query(`ALTER TABLE "lead_topics" ADD "locality" text`);
        await queryRunner.query(`ALTER TABLE "lead_topics" ADD "searchRadiusMiles" integer`);
        await queryRunner.query(`ALTER TABLE "lead_topics" ALTER COLUMN "sources" SET DEFAULT '{}'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4efd5b2ae8c133e7bb5853fcc4" ON "lead_topic_links" ("leadId", "topicId") `);
        await queryRunner.query(`ALTER TABLE "lead_topic_links" ADD CONSTRAINT "FK_59e2b9b52d8a90977fbc27646c2" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lead_topic_links" ADD CONSTRAINT "FK_f6ee474a454e1947395e101fe8b" FOREIGN KEY ("topicId") REFERENCES "lead_topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead_topic_links" DROP CONSTRAINT "FK_f6ee474a454e1947395e101fe8b"`);
        await queryRunner.query(`ALTER TABLE "lead_topic_links" DROP CONSTRAINT "FK_59e2b9b52d8a90977fbc27646c2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4efd5b2ae8c133e7bb5853fcc4"`);
        await queryRunner.query(`ALTER TABLE "lead_topics" ALTER COLUMN "sources" SET DEFAULT '{upwork,linkedin,referral,cold,local,other}'`);
        await queryRunner.query(`ALTER TABLE "lead_topics" DROP COLUMN "searchRadiusMiles"`);
        await queryRunner.query(`ALTER TABLE "lead_topics" DROP COLUMN "locality"`);
        await queryRunner.query(`ALTER TABLE "lead_topic_links" ADD CONSTRAINT "UQ_lead_topic_links_lead_topic" UNIQUE ("leadId", "topicId")`);
        await queryRunner.query(`ALTER TABLE "lead_topic_links" ADD CONSTRAINT "FK_lead_topic_links_topic" FOREIGN KEY ("topicId") REFERENCES "lead_topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lead_topic_links" ADD CONSTRAINT "FK_lead_topic_links_lead" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
