import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1753368732951 implements MigrationInterface {
    name = 'Initial1753368732951'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."change_changetype_enum" AS ENUM('ADDITION', 'MODIFICATION', 'DELETION')`);
        await queryRunner.query(`CREATE TYPE "public"."change_resolution_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "change" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "changeType" "public"."change_changetype_enum" NOT NULL, "changeDescription" character varying NOT NULL, "changeDate" TIMESTAMP NOT NULL, "requestor" character varying NOT NULL, "approver" character varying NOT NULL, "resolution" "public"."change_resolution_enum" NOT NULL DEFAULT 'PENDING', "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "projectId" uuid, CONSTRAINT "PK_38168d337b66a2d98e059fe5820" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "project_journal" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" character varying NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "analysis" character varying, "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedBy" character varying NOT NULL, "deletedAt" TIMESTAMP NOT NULL, "projectId" uuid, CONSTRAINT "PK_386cd2e96c4d78d7e5c9001a102" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."risk_impact_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH')`);
        await queryRunner.query(`CREATE TYPE "public"."risk_likelihood_enum" AS ENUM('UNLIKELY', 'POSSIBLE', 'LIKELY', 'IMMINENT', 'ALMOST_CERTAIN', 'CERTAIN', 'NOT_APPLICABLE', 'UNKNOWN')`);
        await queryRunner.query(`CREATE TYPE "public"."risk_status_enum" AS ENUM('OPEN', 'IN_PROGRESS', 'CLOSED')`);
        await queryRunner.query(`CREATE TYPE "public"."risk_resolution_enum" AS ENUM('PENDING', 'ACCEPTED', 'MITIGATED', 'ESCALATED', 'AVOIDED')`);
        await queryRunner.query(`CREATE TABLE "risk" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" character varying NOT NULL, "impact" "public"."risk_impact_enum" NOT NULL DEFAULT 'MEDIUM', "likelihood" "public"."risk_likelihood_enum" NOT NULL DEFAULT 'UNKNOWN', "status" "public"."risk_status_enum" NOT NULL DEFAULT 'OPEN', "resolution" "public"."risk_resolution_enum" NOT NULL DEFAULT 'PENDING', "createdBy" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedBy" character varying NOT NULL, "deletedAt" TIMESTAMP NOT NULL, "mitigationPlan" character varying NOT NULL, "riskOwner" character varying NOT NULL, "projectId" uuid, CONSTRAINT "PK_955c5a23813b1704181c9a5f7c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."timer_status_enum" AS ENUM('STARTED', 'PAUSED', 'STOPPED')`);
        await queryRunner.query(`CREATE TABLE "timer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."timer_status_enum" NOT NULL DEFAULT 'STOPPED', "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP, "elapsedTime" integer NOT NULL DEFAULT '0', "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedBy" character varying NOT NULL, "deletedAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_b476163e854c74bff55b29d320a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."task_status_enum" AS ENUM('TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED')`);
        await queryRunner.query(`CREATE TYPE "public"."task_createdby_enum" AS ENUM('LOW', 'MEDIUM_LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH')`);
        await queryRunner.query(`CREATE TABLE "task" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" character varying NOT NULL, "status" "public"."task_status_enum" NOT NULL DEFAULT 'TODO', "createdBy" "public"."task_createdby_enum" NOT NULL DEFAULT 'MEDIUM', "createdAt" TIMESTAMP NOT NULL, "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedBy" character varying NOT NULL, "deletedAt" TIMESTAMP NOT NULL, "projectId" uuid, CONSTRAINT "PK_fb213f79ee45060ba925ecd576e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "project" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner" character varying NOT NULL, "members" text array NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP DEFAULT NULL, "status" character varying NOT NULL, "createdBy" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedBy" character varying DEFAULT NULL, "deletedAt" TIMESTAMP DEFAULT NULL, CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "change" ADD CONSTRAINT "FK_e04b850097b3e15668e602f6db4" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_journal" ADD CONSTRAINT "FK_77232867da66b58cf6e032552f5" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "risk" ADD CONSTRAINT "FK_920ed8a2c342ac6ae35e08ffa01" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task" ADD CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task" DROP CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe"`);
        await queryRunner.query(`ALTER TABLE "risk" DROP CONSTRAINT "FK_920ed8a2c342ac6ae35e08ffa01"`);
        await queryRunner.query(`ALTER TABLE "project_journal" DROP CONSTRAINT "FK_77232867da66b58cf6e032552f5"`);
        await queryRunner.query(`ALTER TABLE "change" DROP CONSTRAINT "FK_e04b850097b3e15668e602f6db4"`);
        await queryRunner.query(`DROP TABLE "project"`);
        await queryRunner.query(`DROP TABLE "task"`);
        await queryRunner.query(`DROP TYPE "public"."task_createdby_enum"`);
        await queryRunner.query(`DROP TYPE "public"."task_status_enum"`);
        await queryRunner.query(`DROP TABLE "timer"`);
        await queryRunner.query(`DROP TYPE "public"."timer_status_enum"`);
        await queryRunner.query(`DROP TABLE "risk"`);
        await queryRunner.query(`DROP TYPE "public"."risk_resolution_enum"`);
        await queryRunner.query(`DROP TYPE "public"."risk_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."risk_likelihood_enum"`);
        await queryRunner.query(`DROP TYPE "public"."risk_impact_enum"`);
        await queryRunner.query(`DROP TABLE "project_journal"`);
        await queryRunner.query(`DROP TABLE "change"`);
        await queryRunner.query(`DROP TYPE "public"."change_resolution_enum"`);
        await queryRunner.query(`DROP TYPE "public"."change_changetype_enum"`);
    }

}
