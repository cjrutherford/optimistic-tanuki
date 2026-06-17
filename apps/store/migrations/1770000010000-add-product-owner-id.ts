import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductOwnerId1770000010000 implements MigrationInterface {
  name = 'AddProductOwnerId1770000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ownerId" uuid NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "ownerId"`
    );
  }
}
