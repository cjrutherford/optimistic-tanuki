import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ownership for authored offerings.
 *
 * Offerings are not rows, they live nested inside a ProgramTrack's JSONB
 * `data` column, so ownership cannot be a foreign key column on an offering
 * table that does not exist. This table is the side record instead, keyed on
 * the offering's own id (a ProgramTrack-scoped identifier, not a uuid).
 */
export class OfferingOwnership1770000000006 implements MigrationInterface {
  name = 'OfferingOwnership1770000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_offering_ownership" (
        "offeringId" character varying(128) NOT NULL,
        "ownerProfileId" uuid NOT NULL,
        "coEditorProfileIds" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_offering_ownership" PRIMARY KEY ("offeringId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lp_offering_ownership_owner" ON "lp_offering_ownership" ("ownerProfileId")`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_offering_ownership"`);
  }
}
