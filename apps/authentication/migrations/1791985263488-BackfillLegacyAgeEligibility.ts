import { MigrationInterface, QueryRunner } from "typeorm";

export class BackfillLegacyAgeEligibility1791985263488 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Entity metadata cannot distinguish pre-deployment accounts from
        // accounts created after the new column default. Mark the population
        // present at cutover as grandfathered in this data-only migration.
        await queryRunner.query(
            `UPDATE "user_entity" SET "ageEligibilityStatus" = 'legacy' WHERE "ageEligibilityStatus" = 'unassessed'`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "user_entity" SET "ageEligibilityStatus" = 'unassessed' WHERE "ageEligibilityStatus" = 'legacy'`
        );
    }

}
