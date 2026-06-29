import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessPageAnchorColumns1782648600000
  implements MigrationInterface
{
  name = 'BusinessPageAnchorColumns1782648600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_pages" ADD COLUMN IF NOT EXISTS "anchorLat" double precision`
    );
    await queryRunner.query(
      `ALTER TABLE "business_pages" ADD COLUMN IF NOT EXISTS "anchorLng" double precision`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_pages" DROP COLUMN IF EXISTS "anchorLng"`
    );
    await queryRunner.query(
      `ALTER TABLE "business_pages" DROP COLUMN IF EXISTS "anchorLat"`
    );
  }
}
