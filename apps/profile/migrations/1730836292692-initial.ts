import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1730836292692 implements MigrationInterface {
    name = 'Initial1730836292692'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "project" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "userId" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "relatedProfileId" uuid, "timeLineEventsId" uuid, "goalsId" uuid, CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "goal" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "target" integer NOT NULL, "progress" integer NOT NULL, "userId" character varying NOT NULL, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP, "completed" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "relatedProfileId" uuid, "relatedProjectId" uuid, CONSTRAINT "PK_88c8e2b461b711336c836b1e130" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."timeline_eventtype_enum" AS ENUM('AddedGoal', 'AddedProject', 'UpdatedGoal', 'UpdatedProject', 'CreateProfile', 'UpdatedProfile', 'CompletedGoal', 'CompletedProject', 'DeletedGoal', 'Posted', 'Commented', 'Liked', 'Contributed')`);
        await queryRunner.query(`CREATE TABLE "timeline" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "title" character varying NOT NULL, "description" character varying NOT NULL, "timeStamp" TIMESTAMP NOT NULL DEFAULT now(), "eventType" "public"."timeline_eventtype_enum" NOT NULL DEFAULT 'Posted', "relatedGoalId" uuid, "relatedProjectId" uuid, "relatedProfileId" uuid, CONSTRAINT "PK_f841188896cefd9277904ec40b9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "profileName" character varying NOT NULL, "profilePic" character varying NOT NULL, "coverPic" character varying NOT NULL, "bio" character varying NOT NULL, "location" character varying NOT NULL, "occupation" character varying NOT NULL, "interests" character varying NOT NULL, "skills" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3dd8bfc97e4a77c70971591bdcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "project" ADD CONSTRAINT "FK_d34788b2e854d08f75314eee263" FOREIGN KEY ("relatedProfileId") REFERENCES "profile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project" ADD CONSTRAINT "FK_7bf14e7a2ddf71ebeb96ddb501e" FOREIGN KEY ("timeLineEventsId") REFERENCES "timeline"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project" ADD CONSTRAINT "FK_09c225f84cc55a21eca7ce9eb2c" FOREIGN KEY ("goalsId") REFERENCES "goal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goal" ADD CONSTRAINT "FK_6f3d4df49109f8eeea25a4031e6" FOREIGN KEY ("relatedProfileId") REFERENCES "profile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goal" ADD CONSTRAINT "FK_82883b5ad5d3af2e93f63212d6c" FOREIGN KEY ("relatedProjectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timeline" ADD CONSTRAINT "FK_bea45f601c918784038f56f9b80" FOREIGN KEY ("relatedGoalId") REFERENCES "goal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timeline" ADD CONSTRAINT "FK_4b2c95c68243b9c3acbd9e7ea0d" FOREIGN KEY ("relatedProjectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timeline" ADD CONSTRAINT "FK_6f73d927c0033fd7599f4883bb0" FOREIGN KEY ("relatedProfileId") REFERENCES "profile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "timeline" DROP CONSTRAINT "FK_6f73d927c0033fd7599f4883bb0"`);
        await queryRunner.query(`ALTER TABLE "timeline" DROP CONSTRAINT "FK_4b2c95c68243b9c3acbd9e7ea0d"`);
        await queryRunner.query(`ALTER TABLE "timeline" DROP CONSTRAINT "FK_bea45f601c918784038f56f9b80"`);
        await queryRunner.query(`ALTER TABLE "goal" DROP CONSTRAINT "FK_82883b5ad5d3af2e93f63212d6c"`);
        await queryRunner.query(`ALTER TABLE "goal" DROP CONSTRAINT "FK_6f3d4df49109f8eeea25a4031e6"`);
        await queryRunner.query(`ALTER TABLE "project" DROP CONSTRAINT "FK_09c225f84cc55a21eca7ce9eb2c"`);
        await queryRunner.query(`ALTER TABLE "project" DROP CONSTRAINT "FK_7bf14e7a2ddf71ebeb96ddb501e"`);
        await queryRunner.query(`ALTER TABLE "project" DROP CONSTRAINT "FK_d34788b2e854d08f75314eee263"`);
        await queryRunner.query(`DROP TABLE "profile"`);
        await queryRunner.query(`DROP TABLE "timeline"`);
        await queryRunner.query(`DROP TYPE "public"."timeline_eventtype_enum"`);
        await queryRunner.query(`DROP TABLE "goal"`);
        await queryRunner.query(`DROP TABLE "project"`);
    }

}
