import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1768770957496 implements MigrationInterface {
    name = 'InitialSchema1768770957496';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create app_configurations table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "app_configurations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "description" text,
                "domain" character varying,
                "isActive" boolean NOT NULL DEFAULT true,
                "landingPage" jsonb NOT NULL DEFAULT '{"sections":[],"layout":"single-column"}',
                "routes" jsonb NOT NULL DEFAULT '[]',
                "features" jsonb NOT NULL DEFAULT '{}',
                "theme" jsonb NOT NULL DEFAULT '{}',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_app_configurations" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_app_configurations_name" UNIQUE ("name")
            )
        `);

        // Create uuid extension if not exists
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        
        // Create indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_app_configurations_domain" ON "app_configurations" ("domain")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_app_configurations_isActive" ON "app_configurations" ("isActive")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_app_configurations_isActive"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_app_configurations_domain"`);
        
        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS "app_configurations"`);
    }

}
