import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDonationPaymentReference1789928955679
  implements MigrationInterface
{
  name = 'AddDonationPaymentReference1789928955679';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donations" ADD "paymentDonationId" uuid`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "paymentDonationId"`
    );
  }
}
