import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinCommander1772000000000 implements MigrationInterface {
  name = 'FinCommander1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "fin_commander_plan" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "defaultWorkspace" character varying NOT NULL DEFAULT 'personal', "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_fin_commander_plan" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "fin_commander_goal" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "planId" uuid NOT NULL, "name" character varying NOT NULL, "targetAmountCents" integer NOT NULL, "currentAmountCents" integer NOT NULL DEFAULT 0, "dueDate" date NOT NULL, "strategy" text NOT NULL DEFAULT '', "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_fin_commander_goal" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "fin_commander_scenario" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "planId" uuid NOT NULL, "name" character varying NOT NULL, "summary" text NOT NULL DEFAULT '', "assumptions" jsonb NOT NULL DEFAULT '[]', "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_fin_commander_scenario" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_plan" ADD CONSTRAINT "FK_fin_commander_plan_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_goal" ADD CONSTRAINT "FK_fin_commander_goal_plan" FOREIGN KEY ("planId") REFERENCES "fin_commander_plan"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_goal" ADD CONSTRAINT "FK_fin_commander_goal_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_scenario" ADD CONSTRAINT "FK_fin_commander_scenario_plan" FOREIGN KEY ("planId") REFERENCES "fin_commander_plan"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_scenario" ADD CONSTRAINT "FK_fin_commander_scenario_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fin_commander_goal_plan_scope" ON "fin_commander_goal" ("planId", "tenantId", "profileId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fin_commander_scenario_plan_scope" ON "fin_commander_scenario" ("planId", "tenantId", "profileId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fin_commander_plan_scope" ON "fin_commander_plan" ("tenantId", "profileId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_fin_commander_plan_scope"`);
    await queryRunner.query(
      `DROP INDEX "IDX_fin_commander_scenario_plan_scope"`
    );
    await queryRunner.query(`DROP INDEX "IDX_fin_commander_goal_plan_scope"`);
    await queryRunner.query(
      `ALTER TABLE "fin_commander_scenario" DROP CONSTRAINT "FK_fin_commander_scenario_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_scenario" DROP CONSTRAINT "FK_fin_commander_scenario_plan"`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_goal" DROP CONSTRAINT "FK_fin_commander_goal_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_goal" DROP CONSTRAINT "FK_fin_commander_goal_plan"`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_plan" DROP CONSTRAINT "FK_fin_commander_plan_tenant"`
    );
    await queryRunner.query(`DROP TABLE "fin_commander_scenario"`);
    await queryRunner.query(`DROP TABLE "fin_commander_goal"`);
    await queryRunner.query(`DROP TABLE "fin_commander_plan"`);
  }
}
