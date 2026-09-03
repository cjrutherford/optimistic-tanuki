import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersonaCapabilities1788300816654 implements MigrationInterface {
  name = 'PersonaCapabilities1788300816654';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "persona_telos" ADD "capabilities" text array`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "persona_telos" DROP COLUMN "capabilities"`
    );
  }
}
