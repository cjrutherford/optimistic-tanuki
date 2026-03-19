import { MigrationInterface, QueryRunner } from "typeorm";

export class CommunityHighlights1773844748371 implements MigrationInterface {
    name = 'CommunityHighlights1773844748371'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community" DROP CONSTRAINT "community_parentId_fkey"`);
        await queryRunner.query(`ALTER TABLE "community" ADD "highlights" jsonb`);
        await queryRunner.query(`ALTER TABLE "community" ADD CONSTRAINT "FK_7499b5a84e4283786b671480312" FOREIGN KEY ("parentId") REFERENCES "community"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community" DROP CONSTRAINT "FK_7499b5a84e4283786b671480312"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "highlights"`);
        await queryRunner.query(`ALTER TABLE "community" ADD CONSTRAINT "community_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "community"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
