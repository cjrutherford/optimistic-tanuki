import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileTelosCharacterSheet1770000002000
  implements MigrationInterface
{
  name = 'AddProfileTelosCharacterSheet1770000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ADD COLUMN "profileId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ADD COLUMN "appScope" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ADD COLUMN "generationStatus" character varying NOT NULL DEFAULT 'pending'`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ADD COLUMN "generatedAt" TIMESTAMP`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ADD COLUMN "sourceUpdatedAt" TIMESTAMP`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ADD COLUMN "sourceCount" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ADD COLUMN "sourceFacts" jsonb NOT NULL DEFAULT '[]'`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ADD COLUMN "characterSheet" jsonb NOT NULL DEFAULT '{}'`
    );
    await queryRunner.query(
      `UPDATE "profile_telos" SET "profileId" = id WHERE "profileId" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ALTER COLUMN "profileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" ADD CONSTRAINT "UQ_profile_telos_profileId" UNIQUE ("profileId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile_telos" DROP CONSTRAINT "UQ_profile_telos_profileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" DROP COLUMN "characterSheet"`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" DROP COLUMN "sourceFacts"`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" DROP COLUMN "sourceCount"`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" DROP COLUMN "sourceUpdatedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" DROP COLUMN "generatedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" DROP COLUMN "generationStatus"`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" DROP COLUMN "appScope"`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_telos" DROP COLUMN "profileId"`
    );
  }
}
