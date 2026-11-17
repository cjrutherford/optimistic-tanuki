import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityDirectoryCapture1793906078330
  implements MigrationInterface
{
  name = 'CommunityDirectoryCapture1793906078330';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_directory_epoch" ADD "registerBaselineEpoch" uuid`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_directory_epoch" DROP COLUMN "registerBaselineEpoch"`
    );
  }
}
