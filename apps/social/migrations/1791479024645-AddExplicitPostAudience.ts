import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExplicitPostAudience1791479024645
  implements MigrationInterface
{
  name = 'AddExplicitPostAudience1791479024645';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "publicAudienceExplicit" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" DROP COLUMN "publicAudienceExplicit"`
    );
  }
}
