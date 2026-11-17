import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794773566665 implements MigrationInterface {
    name = 'DirectoryFoundation1794773566665'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_boundary_decision" ALTER COLUMN "reviewerId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "directory_boundary_decision" ALTER COLUMN "sourceUrl" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "directory_business_link_request" ALTER COLUMN "ownerId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "directory_business_link_event" ALTER COLUMN "actorId" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "directory_business_link_event" ALTER COLUMN "actorId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "directory_business_link_request" ALTER COLUMN "ownerId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "directory_boundary_decision" ALTER COLUMN "sourceUrl" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "directory_boundary_decision" ALTER COLUMN "reviewerId" SET NOT NULL`);
    }

}
