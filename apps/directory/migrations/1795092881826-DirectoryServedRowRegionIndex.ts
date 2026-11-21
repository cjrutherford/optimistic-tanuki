import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryServedRowRegionIndex1795092881826
  implements MigrationInterface
{
  name = 'DirectoryServedRowRegionIndex1795092881826';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_overture_private_row_region" ON "directory_overture_private_row" ("regionId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_overture_private_row_region"`
    );
  }
}
