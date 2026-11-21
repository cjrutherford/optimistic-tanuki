import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794147743066 implements MigrationInterface {
  name = 'DirectoryFoundation1794147743066';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_boundary_decision" ADD "invalidatedAt" TIMESTAMP WITH TIME ZONE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_boundary_decision" DROP COLUMN "invalidatedAt"`
    );
  }
}
