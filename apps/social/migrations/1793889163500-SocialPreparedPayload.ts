import { MigrationInterface, QueryRunner } from "typeorm";

export class SocialPreparedPayload1793889163500 implements MigrationInterface {
    name = 'SocialPreparedPayload1793889163500'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" ADD "preparedPayload" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community_directory_epoch" DROP COLUMN "preparedPayload"`);
    }

}
