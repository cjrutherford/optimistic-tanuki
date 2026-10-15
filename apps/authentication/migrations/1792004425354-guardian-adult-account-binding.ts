import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuardianAdultAccountBinding1792004425354
  implements MigrationInterface
{
  name = 'GuardianAdultAccountBinding1792004425354';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "guardian_permission" ADD "guardianUserId" uuid'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "guardian_permission" DROP COLUMN "guardianUserId"'
    );
  }
}
