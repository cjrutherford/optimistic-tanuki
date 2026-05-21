import { MigrationInterface, QueryRunner } from "typeorm";

export class ConversationType1772221462386 implements MigrationInterface {
    name = 'ConversationType1772221462386'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."conversation_type_enum" AS ENUM('direct', 'community')`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD "type" "public"."conversation_type_enum" NOT NULL DEFAULT 'direct'`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD "communityId" character varying`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD "ownerId" character varying`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD "isDeleted" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "conversation" ALTER COLUMN "createdAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "conversation" ALTER COLUMN "createdAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "conversation" ALTER COLUMN "updatedAt" SET DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation" ALTER COLUMN "updatedAt" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "conversation" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "conversation" ALTER COLUMN "createdAt" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "isDeleted"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "ownerId"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "communityId"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."conversation_type_enum"`);
    }

}
