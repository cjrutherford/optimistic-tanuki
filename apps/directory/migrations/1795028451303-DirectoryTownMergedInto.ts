import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryTownMergedInto1795028451303
  implements MigrationInterface
{
  name = 'DirectoryTownMergedInto1795028451303';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_town" ADD "mergedIntoCommunityId" uuid`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_town" DROP COLUMN "mergedIntoCommunityId"`
    );
  }
}
