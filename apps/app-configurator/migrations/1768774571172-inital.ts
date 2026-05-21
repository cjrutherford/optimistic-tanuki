import { MigrationInterface, QueryRunner } from "typeorm";

export class Inital1768774571172 implements MigrationInterface {
    name = 'Inital1768774571172'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "app_configuration_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "domain" character varying, "landingPage" jsonb NOT NULL, "routes" jsonb NOT NULL DEFAULT '[]', "features" jsonb NOT NULL DEFAULT '{}', "theme" jsonb NOT NULL DEFAULT '{}', "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP, CONSTRAINT "UQ_640e0f2777c07298bcea44ed866" UNIQUE ("name"), CONSTRAINT "UQ_0ee10d0d7b62c3bac73bee3ddf9" UNIQUE ("domain"), CONSTRAINT "PK_c8bd05be9c2f7b2e9db27233e44" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "app_configuration_entity"`);
    }

}
