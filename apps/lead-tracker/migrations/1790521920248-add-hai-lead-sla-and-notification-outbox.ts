import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHaiLeadSlaAndNotificationOutbox1790521920248
  implements MigrationInterface
{
  name = 'AddHaiLeadSlaAndNotificationOutbox1790521920248';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lead_notification_outbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "leadId" uuid NOT NULL, "recipientEmail" character varying(254) NOT NULL, "eventType" character varying(24) NOT NULL, "subject" character varying(240) NOT NULL, "text" text NOT NULL, "html" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lastError" text, "sentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fcf9a0e828260ee47aad1f47880" UNIQUE ("leadId", "recipientEmail", "eventType"), CONSTRAINT "PK_5c11d4ebcdc6a0cbbdd72098a54" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_533409e13fd1493d5d6dc08e7a" ON "lead_notification_outbox" ("status", "nextAttemptAt") `
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "dueAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "firstPersonalResponseAt" TIMESTAMP WITH TIME ZONE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN "firstPersonalResponseAt"`
    );
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "dueAt"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_533409e13fd1493d5d6dc08e7a"`
    );
    await queryRunner.query(`DROP TABLE "lead_notification_outbox"`);
  }
}
