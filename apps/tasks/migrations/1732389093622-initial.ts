import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1732389093622 implements MigrationInterface {
    name = 'Initial1732389093622'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."timer_entity_status_enum" AS ENUM('active', 'paused', 'completed', 'deleted')`);
        await queryRunner.query(`CREATE TABLE "timer_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "start" TIMESTAMP NOT NULL, "end" TIMESTAMP, "duration" integer NOT NULL DEFAULT '0', "description" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedAt" TIMESTAMP, "status" "public"."timer_entity_status_enum" NOT NULL DEFAULT 'active', "taskId" uuid, CONSTRAINT "PK_c79cea11347df20a8b78bc6336a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."note_entity_status_enum" AS ENUM('draft', 'published', 'archived', 'deleted', 'public')`);
        await queryRunner.query(`CREATE TABLE "note_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "projectId" character varying, "taskId" uuid, "title" character varying NOT NULL, "description" character varying NOT NULL, "contents" text NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "status" "public"."note_entity_status_enum" NOT NULL DEFAULT 'draft', CONSTRAINT "PK_664c6fdaf79389734ae737f7d27" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."task_entity_status_enum" AS ENUM('draft', 'published', 'archived', 'deleted', 'public')`);
        await queryRunner.query(`CREATE TABLE "task_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedAt" TIMESTAMP NOT NULL, "status" "public"."task_entity_status_enum" NOT NULL DEFAULT 'draft', CONSTRAINT "PK_0385ca690d1697cdf7ff1ed3c2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "timer_entity" ADD CONSTRAINT "FK_42b0d3009d3200280fd006ea4fe" FOREIGN KEY ("taskId") REFERENCES "task_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "note_entity" ADD CONSTRAINT "FK_2ec642c894853482950394dab3c" FOREIGN KEY ("taskId") REFERENCES "task_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "note_entity" DROP CONSTRAINT "FK_2ec642c894853482950394dab3c"`);
        await queryRunner.query(`ALTER TABLE "timer_entity" DROP CONSTRAINT "FK_42b0d3009d3200280fd006ea4fe"`);
        await queryRunner.query(`DROP TABLE "task_entity"`);
        await queryRunner.query(`DROP TYPE "public"."task_entity_status_enum"`);
        await queryRunner.query(`DROP TABLE "note_entity"`);
        await queryRunner.query(`DROP TYPE "public"."note_entity_status_enum"`);
        await queryRunner.query(`DROP TABLE "timer_entity"`);
        await queryRunner.query(`DROP TYPE "public"."timer_entity_status_enum"`);
    }

}
