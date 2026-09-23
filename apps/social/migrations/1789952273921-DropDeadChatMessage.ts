import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O12 (decided: drop dead code only): drop the unreferenced `chat_message`
 * table. The entity + service + spec were removed with zero callers and zero
 * rows (verified empty pre-drop).
 *
 * Rewritten from the generated diff, which missed the drop entirely and
 * instead contained unrelated enum drift on community tables (left out as
 * destructive and out of scope). Down restores the exact prior schema.
 */
export class DropDeadChatMessage1789952273921 implements MigrationInterface {
  name = 'DropDeadChatMessage1789952273921';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "chat_message"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chat_message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" character varying NOT NULL, "senderId" character varying NOT NULL, "content" text NOT NULL, "reactions" text, "isEdited" boolean NOT NULL DEFAULT false, "isDeleted" boolean NOT NULL DEFAULT false, "readBy" text, "type" character varying NOT NULL DEFAULT 'chat', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY ("id"))`
    );
  }
}
