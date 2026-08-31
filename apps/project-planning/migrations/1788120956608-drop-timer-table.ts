import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written, which is an exception to the rule here, and this is why.
 *
 * The Timer entity is gone: it was one clock per task where time entries are
 * many, it documented a start, pause and stop state machine that nothing
 * implemented, and it could not be created at all because its DTO accepted a
 * task id while the entity needed three non-nullable columns nobody supplied.
 * The table has never held a row.
 *
 * `migration:generate` compares entities to the schema and only manages tables
 * it knows about. With the entity deleted it no longer knows about this one,
 * so it reports no changes and will keep reporting none forever. There is no
 * generated migration that drops this table, and waiting for one means keeping
 * dead schema and a name that makes the next person wonder what it was for.
 *
 * So this was created with `migration:create` and written by hand. Everything
 * in it is copied from the migrations that built the table, so the down is a
 * faithful reversal rather than an approximation: the CREATE TABLE comes from
 * 1753991364111-initial and the appScope column from 1769897125708-app-scope.
 *
 * Safe to run because the table is empty. If a deployment somewhere has rows
 * in it, they came from outside this application, since nothing here could
 * write one.
 */
export class DropTimerTable1788120956608 implements MigrationInterface {
  name = 'DropTimerTable1788120956608';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "timer"`);
    await queryRunner.query(`DROP TYPE "public"."timer_status_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."timer_status_enum" AS ENUM('STARTED', 'PAUSED', 'STOPPED')`
    );
    await queryRunner.query(
      `CREATE TABLE "timer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."timer_status_enum" NOT NULL DEFAULT 'STOPPED', "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP, "elapsedTime" integer NOT NULL DEFAULT '0', "updatedBy" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "deletedBy" character varying, "deletedAt" TIMESTAMP, CONSTRAINT "PK_b476163e854c74bff55b29d320a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "timer" ADD "appScope" character varying NOT NULL DEFAULT 'project-planning'`
    );
  }
}
