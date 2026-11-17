import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794774382803 implements MigrationInterface {
  name = 'DirectoryFoundation1794774382803';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_business_link_event" ADD "actorDomain" character varying(16)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_business_link_event" DROP COLUMN "actorDomain"`
    );
  }
}
