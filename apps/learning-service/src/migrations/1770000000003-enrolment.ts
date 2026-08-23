import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces enrolment as a real record.
 *
 * Until now nothing in this service recorded that a learner had claimed an
 * offering; lesson_progress rows existed or they didn't. This table is the
 * fact that "someone is taking this course", keyed to their learning-scoped
 * profile rather than a bare userId, and a following migration makes lesson
 * progress depend on it.
 */
export class Enrolment1770000000003 implements MigrationInterface {
  name = 'Enrolment1770000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_enrolment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "profileId" uuid NOT NULL,
        "offeringId" character varying(128) NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'active',
        "enrolledAt" TIMESTAMP NOT NULL DEFAULT now(),
        "withdrawnAt" TIMESTAMP,
        CONSTRAINT "PK_lp_enrolment" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lp_enrolment_profile_offering" UNIQUE ("profileId", "offeringId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lp_enrolment_profile" ON "lp_enrolment" ("profileId")`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_enrolment"`);
  }
}
