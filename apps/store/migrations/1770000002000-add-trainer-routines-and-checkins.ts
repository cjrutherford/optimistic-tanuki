import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainerRoutinesAndCheckins1770000002000 implements MigrationInterface {
  name = 'AddTrainerRoutinesAndCheckins1770000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trainer_routine_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid NOT NULL,
        "clientName" character varying(255) NOT NULL,
        "title" character varying(255) NOT NULL,
        "summary" text NOT NULL,
        "focusAreas" text array NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trainer_routine_assignments_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trainer_progress_check_ins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid NOT NULL,
        "assignmentId" uuid NOT NULL,
        "notes" text NOT NULL,
        "energy" integer NOT NULL,
        "completedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trainer_progress_check_ins_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "trainer_progress_check_ins"');
    await queryRunner.query('DROP TABLE IF EXISTS "trainer_routine_assignments"');
  }
}
