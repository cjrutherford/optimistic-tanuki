import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryAckAuthority1793844047698 implements MigrationInterface {
  name = 'DirectoryAckAuthority1793844047698';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_directory_epoch" ADD "directoryRecoveryEpoch" uuid`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_directory_epoch" DROP COLUMN "directoryRecoveryEpoch"`
    );
  }
}
