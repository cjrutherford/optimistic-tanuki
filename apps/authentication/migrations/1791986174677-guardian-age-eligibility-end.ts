import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuardianAgeEligibilityEnd1791986174677
  implements MigrationInterface
{
  name = 'GuardianAgeEligibilityEnd1791986174677';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "ageEligibilityEndsAt" date`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP COLUMN "ageEligibilityEndsAt"`
    );
  }
}
