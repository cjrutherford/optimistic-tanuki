import { MigrationInterface, QueryRunner } from "typeorm";

export class GuardianProfileActivity1792030280091 implements MigrationInterface {
    name = 'GuardianProfileActivity1792030280091'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "guardian_profile_activity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorUserId" uuid NOT NULL, "dependentUserId" uuid NOT NULL, "profileId" uuid NOT NULL, "appId" character varying(64) NOT NULL, "operation" character varying(32) NOT NULL, "changedFieldNames" text array NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1662e2fc57584bcd7e4d4abf073" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_guardian_profile_activity_created_at" ON "guardian_profile_activity" ("createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_guardian_profile_activity_created_at"`);
        await queryRunner.query(`DROP TABLE "guardian_profile_activity"`);
    }

}
