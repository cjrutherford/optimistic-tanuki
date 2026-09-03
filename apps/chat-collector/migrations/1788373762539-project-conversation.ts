import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectConversation1788373762539 implements MigrationInterface {
  name = 'ProjectConversation1788373762539';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation" ADD "projectId" character varying`
    );
    await queryRunner.query(
      `ALTER TYPE "public"."conversation_type_enum" RENAME TO "conversation_type_enum_old"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversation_type_enum" AS ENUM('direct', 'community', 'project')`
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ALTER COLUMN "type" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ALTER COLUMN "type" TYPE "public"."conversation_type_enum" USING "type"::"text"::"public"."conversation_type_enum"`
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ALTER COLUMN "type" SET DEFAULT 'direct'`
    );
    await queryRunner.query(`DROP TYPE "public"."conversation_type_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."conversation_type_enum_old" AS ENUM('direct', 'community')`
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ALTER COLUMN "type" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ALTER COLUMN "type" TYPE "public"."conversation_type_enum_old" USING "type"::"text"::"public"."conversation_type_enum_old"`
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ALTER COLUMN "type" SET DEFAULT 'direct'`
    );
    await queryRunner.query(`DROP TYPE "public"."conversation_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."conversation_type_enum_old" RENAME TO "conversation_type_enum"`
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" DROP COLUMN "projectId"`
    );
  }
}
