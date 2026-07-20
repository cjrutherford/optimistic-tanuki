import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelAnchorColumns1782648000000 implements MigrationInterface {
  name = 'ChannelAnchorColumns1782648000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "anchorLat" double precision`
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "anchorLng" double precision`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel" DROP COLUMN IF EXISTS "anchorLng"`
    );
    await queryRunner.query(
      `ALTER TABLE "channel" DROP COLUMN IF EXISTS "anchorLat"`
    );
  }
}
