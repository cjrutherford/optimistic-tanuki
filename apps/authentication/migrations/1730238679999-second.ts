import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Second database migration for the authentication service.
 * Adds a `totpSecret` column to the `user_entity` table.
 */
export class Second1730238679999 implements MigrationInterface {
    name = 'Second1730238679999'

    /**
     * Applies the migration to the database.
     * Adds the `totpSecret` column to the `user_entity` table.
     * @param queryRunner The QueryRunner instance.
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_entity" ADD "totpSecret" character varying`);
    }

    /**
     * Reverts the migration from the database.
     * Drops the `totpSecret` column from the `user_entity` table.
     * @param queryRunner The QueryRunner instance.
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_entity" DROP COLUMN "totpSecret"`);
    }

}
