import { MigrationInterface, QueryRunner } from "typeorm";

export class CommunityDirectoryChange1793820819556 implements MigrationInterface {
    name = 'CommunityDirectoryChange1793820819556'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "community_directory_change" ("revision" BIGSERIAL NOT NULL, "communityId" uuid NOT NULL, "operation" character varying(16) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_71f532a340dfad2b5ead3ff577d" PRIMARY KEY ("revision"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "community_directory_change"`);
    }

}
