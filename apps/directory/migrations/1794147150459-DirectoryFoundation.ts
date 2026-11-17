import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794147150459 implements MigrationInterface {
    name = 'DirectoryFoundation1794147150459'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_boundary_decision" ("requestId" uuid NOT NULL, "communityId" uuid NOT NULL, "reviewerId" uuid NOT NULL, "decision" character varying(16) NOT NULL, "sourceUrl" character varying(2048) NOT NULL, "sourceEpoch" uuid NOT NULL, "activationId" uuid NOT NULL, "socialGeneration" bigint NOT NULL, "recoveryEpoch" uuid NOT NULL, "directoryGeneration" bigint NOT NULL, "changeToken" uuid NOT NULL, "geoid" character varying(10) NOT NULL, "layer" character varying(6) NOT NULL, "vintage" character varying(4) NOT NULL, "stateFips" character varying(2) NOT NULL, "archiveSha256" character varying(64) NOT NULL, "geographyHash" character varying(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_549cb2000e693d39eb72e1ae67b" PRIMARY KEY ("requestId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "directory_boundary_decision"`);
    }

}
