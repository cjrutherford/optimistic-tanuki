import { MigrationInterface, QueryRunner } from "typeorm";

export class CommunityDirectoryEpoch1793841403247 implements MigrationInterface {
    name = 'CommunityDirectoryEpoch1793841403247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "community_directory_epoch" ("id" integer NOT NULL, "sourceEpoch" uuid NOT NULL, "fenced" boolean NOT NULL DEFAULT true, "initializedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "CHK_516a05e7add4a830d078bc5d6e" CHECK ("id" = 1), CONSTRAINT "PK_9c6c6848cad9f9897363d2b477c" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "community_directory_epoch"`);
    }

}
