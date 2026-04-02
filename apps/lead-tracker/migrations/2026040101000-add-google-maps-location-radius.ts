import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleMapsLocationRadius2026040101000
  implements MigrationInterface
{
  name = 'AddGoogleMapsLocationRadius2026040101000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lead_topics" ADD "googleMapsLocation" text`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" ADD "googleMapsRadiusMiles" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lead_topics" DROP COLUMN "googleMapsRadiusMiles"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" DROP COLUMN "googleMapsLocation"`
    );
  }
}
