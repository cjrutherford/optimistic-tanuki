import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostWorkspaceId1787611497663 implements MigrationInterface {
  name = 'AddPostWorkspaceId1787611497663';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "workspaceId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "workspaceId"`);
  }
}
