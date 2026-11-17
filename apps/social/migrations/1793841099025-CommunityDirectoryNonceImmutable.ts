import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityDirectoryNonceImmutable1793841099025
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE FUNCTION community_directory_nonce_immutable() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."eventNonce" IS DISTINCT FROM OLD."eventNonce" THEN
          RAISE EXCEPTION 'community directory event nonce is immutable';
        END IF;
        RETURN NEW;
      END;
      $$`);
    await queryRunner.query(`CREATE TRIGGER community_directory_nonce_immutable
      BEFORE UPDATE ON community_directory_change
      FOR EACH ROW EXECUTE FUNCTION community_directory_nonce_immutable()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS community_directory_nonce_immutable ON community_directory_change'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS community_directory_nonce_immutable()'
    );
  }
}
