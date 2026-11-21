import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryTownRegisteredAt1795005158010
  implements MigrationInterface
{
  name = 'DirectoryTownRegisteredAt1795005158010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_town" ADD "registeredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_town" DROP COLUMN "registeredAt"`
    );
  }
}
