import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadTopicLinks1774812000000 implements MigrationInterface {
    name = 'AddLeadTopicLinks1774812000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "lead_topic_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "leadId" uuid NOT NULL, "topicId" uuid NOT NULL, "linkType" character varying NOT NULL DEFAULT 'auto', "sourceProvider" character varying NOT NULL DEFAULT 'internal', "matchedKeywords" text array NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_lead_topic_links_lead_topic" UNIQUE ("leadId", "topicId"), CONSTRAINT "PK_lead_topic_links_id" PRIMARY KEY ("id"))`
        );
        await queryRunner.query(
            `ALTER TABLE "lead_topic_links" ADD CONSTRAINT "FK_lead_topic_links_lead" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
        );
        await queryRunner.query(
            `ALTER TABLE "lead_topic_links" ADD CONSTRAINT "FK_lead_topic_links_topic" FOREIGN KEY ("topicId") REFERENCES "lead_topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "lead_topic_links" DROP CONSTRAINT "FK_lead_topic_links_topic"`
        );
        await queryRunner.query(
            `ALTER TABLE "lead_topic_links" DROP CONSTRAINT "FK_lead_topic_links_lead"`
        );
        await queryRunner.query(`DROP TABLE "lead_topic_links"`);
    }
}