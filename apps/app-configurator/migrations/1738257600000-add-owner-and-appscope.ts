import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOwnerAndAppscope1738257600000 implements MigrationInterface {
    name = 'AddOwnerAndAppscope1738257600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "app_configuration_entity" ADD "ownerId" character varying`);
        await queryRunner.query(`ALTER TABLE "app_configuration_entity" ADD "appScopeId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "app_configuration_entity" DROP COLUMN "appScopeId"`);
        await queryRunner.query(`ALTER TABLE "app_configuration_entity" DROP COLUMN "ownerId"`);
    }

}
