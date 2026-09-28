import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgendaItemPosition1790529807194 implements MigrationInterface {
  name = 'AddAgendaItemPosition1790529807194';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "civic_agenda_items" ADD "position" integer NOT NULL DEFAULT '0'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "civic_agenda_items" DROP COLUMN "position"`
    );
  }
}
