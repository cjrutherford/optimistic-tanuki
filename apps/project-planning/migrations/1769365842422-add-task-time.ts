import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaskTime1769365842422 implements MigrationInterface {
    name = 'AddTaskTime1769365842422'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "task_note" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" character varying NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "analysis" character varying, "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedBy" character varying, "deletedAt" TIMESTAMP, "taskId" uuid, CONSTRAINT "PK_fff317f9c71735ddd36da4cd24c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "task_tag" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "color" character varying, "description" text, "createdBy" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedBy" character varying, "deletedAt" TIMESTAMP, CONSTRAINT "UQ_db353befe87644b8840808ed95c" UNIQUE ("name"), CONSTRAINT "PK_8dab863fb63f5e94e12ee8f9127" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "task_time_entry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP, "elapsedSeconds" integer NOT NULL DEFAULT '0', "description" text, "createdBy" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedBy" character varying, "deletedAt" TIMESTAMP, "taskId" uuid, CONSTRAINT "PK_2f883512ceaf3457a836917399f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "task_tags" ("task_id" uuid NOT NULL, "tag_id" uuid NOT NULL, CONSTRAINT "PK_a7354e3c3f630636f6e4a29694a" PRIMARY KEY ("task_id", "tag_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_70515bc464901781ac60b82a1e" ON "task_tags" ("task_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f883135d033e1541f6a81972e7" ON "task_tags" ("tag_id") `);
        await queryRunner.query(`ALTER TABLE "task_note" ADD CONSTRAINT "FK_bc063e055555168bb172b12f36f" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_time_entry" ADD CONSTRAINT "FK_36cae699dcb526cc9cccd973bde" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_tags" ADD CONSTRAINT "FK_70515bc464901781ac60b82a1ea" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_tags" ADD CONSTRAINT "FK_f883135d033e1541f6a81972e7d" FOREIGN KEY ("tag_id") REFERENCES "task_tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_tags" DROP CONSTRAINT "FK_f883135d033e1541f6a81972e7d"`);
        await queryRunner.query(`ALTER TABLE "task_tags" DROP CONSTRAINT "FK_70515bc464901781ac60b82a1ea"`);
        await queryRunner.query(`ALTER TABLE "task_time_entry" DROP CONSTRAINT "FK_36cae699dcb526cc9cccd973bde"`);
        await queryRunner.query(`ALTER TABLE "task_note" DROP CONSTRAINT "FK_bc063e055555168bb172b12f36f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f883135d033e1541f6a81972e7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_70515bc464901781ac60b82a1e"`);
        await queryRunner.query(`DROP TABLE "task_tags"`);
        await queryRunner.query(`DROP TABLE "task_time_entry"`);
        await queryRunner.query(`DROP TABLE "task_tag"`);
        await queryRunner.query(`DROP TABLE "task_note"`);
    }

}
