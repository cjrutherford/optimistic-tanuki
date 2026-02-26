import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialWellness1704067200000 implements MigrationInterface {
  name = 'InitialWellness1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "daily_six_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "affirmation" text NOT NULL, "judgement" text NOT NULL, "non_judgement" text NOT NULL, "mindful_activity" text NOT NULL, "gratitude" text NOT NULL, "public" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "profile_id" uuid NOT NULL, CONSTRAINT "PK_daily_six_entity_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "daily_four_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "affirmation" text NOT NULL, "mindful_activity" text NOT NULL, "gratitude" text NOT NULL, "planned_pleasurable" text NOT NULL, "public" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "profile_id" uuid NOT NULL, CONSTRAINT "PK_daily_four_entity_id" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "daily_four_entity"`);
    await queryRunner.query(`DROP TABLE "daily_six_entity"`);
  }
}
