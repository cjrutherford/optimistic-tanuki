import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeUserEmail1777410000000 implements MigrationInterface {
  name = 'NormalizeUserEmail1777410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "user_entity" SET "email" = LOWER(TRIM("email")) WHERE "email" IS NOT NULL`
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT LOWER("email")
          FROM "user_entity"
          GROUP BY LOWER("email")
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot enforce case-insensitive unique emails while duplicates still exist';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_entity_email_lower_unique" ON "user_entity" (LOWER("email"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_entity_email_lower_unique"`
    );
  }
}
