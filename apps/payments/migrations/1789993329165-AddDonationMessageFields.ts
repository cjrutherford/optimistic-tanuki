import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDonationMessageFields1789993329165
  implements MigrationInterface
{
  name = 'AddDonationMessageFields1789993329165';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e744417ceb0b530285c08f3865"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bb58f2b6e30cb51a6504599f4"`
    );
    await queryRunner.query(`ALTER TABLE "donations" ADD "message" text`);
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "anonymous" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_92755ca44f92ac0d3b632af41d" ON "payment_events" ("createdAt") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_54023c65db14e97fe4ffa35ae6" ON "payment_events" ("userId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_54023c65db14e97fe4ffa35ae6"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_92755ca44f92ac0d3b632af41d"`
    );
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "anonymous"`);
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "message"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_6bb58f2b6e30cb51a6504599f4" ON "payment_events" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e744417ceb0b530285c08f3865" ON "payment_events" ("createdAt") `
    );
  }
}
