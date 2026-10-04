import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityLocalitySlug1791073064173
  implements MigrationInterface
{
  name = 'AddCommunityLocalitySlug1791073064173';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community" ADD "localitySlug" character varying(64)`
    );
    await queryRunner.query(
      `ALTER TABLE "community" ADD CONSTRAINT "UQ_3d597dd9e88416dd76ee029ed9e" UNIQUE ("localitySlug")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community" DROP CONSTRAINT "UQ_3d597dd9e88416dd76ee029ed9e"`
    );
    await queryRunner.query(
      `ALTER TABLE "community" DROP COLUMN "localitySlug"`
    );
  }
}
