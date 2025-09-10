import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1755189658315 implements MigrationInterface {
    name = 'Initial1755189658315'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "project_telos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "goals" text array NOT NULL, "skills" text array NOT NULL, "interests" text array NOT NULL, "limitations" text array NOT NULL, "strengths" text array NOT NULL, "objectives" text array NOT NULL, "coreObjective" character varying NOT NULL, "overallProjectSummary" character varying NOT NULL, "profileId" uuid, CONSTRAINT "PK_c2877fa8876ff7e9600cc480f7f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "profile_telos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "goals" text array NOT NULL, "skills" text array NOT NULL, "interests" text array NOT NULL, "limitations" text array NOT NULL, "strengths" text array NOT NULL, "objectives" text array NOT NULL, "coreObjective" character varying NOT NULL, "overallProfileSummary" character varying NOT NULL, CONSTRAINT "PK_cebfb9e76ddbddec75c0e9ff84f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "persona_telos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "goals" text array NOT NULL, "skills" text array NOT NULL, "interests" text array NOT NULL, "limitations" text array NOT NULL, "strengths" text array NOT NULL, "objectives" text array NOT NULL, "coreObjective" character varying NOT NULL, "exampleResponses" text array NOT NULL, "promptTemplate" character varying NOT NULL, CONSTRAINT "PK_59c141bac0579f343d07d763489" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "project_telos" ADD CONSTRAINT "FK_4abeb30fa90b2a7d457724eb599" FOREIGN KEY ("profileId") REFERENCES "profile_telos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project_telos" DROP CONSTRAINT "FK_4abeb30fa90b2a7d457724eb599"`);
        await queryRunner.query(`DROP TABLE "persona_telos"`);
        await queryRunner.query(`DROP TABLE "profile_telos"`);
        await queryRunner.query(`DROP TABLE "project_telos"`);
    }

}
