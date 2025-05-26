import { MigrationInterface, QueryRunner } from "typeorm";

export class Second1730238679999 implements MigrationInterface {
    name = 'Second1730238679999'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_entity" ADD "totpSecret" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_entity" DROP COLUMN "totpSecret"`);
    }

}
