import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocalityObservation1773792000000 implements MigrationInterface {
  name = 'LocalityObservation1773792000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "locality_observation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subjectId" character varying NOT NULL, "source" character varying NOT NULL, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "accuracyMeters" double precision, "observedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying NOT NULL, "confidenceScore" integer NOT NULL, "reasons" text array NOT NULL, "action" character varying NOT NULL DEFAULT 'observe', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_locality_observation_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_locality_observation_subject_source_observed" ON "locality_observation" ("subjectId", "source", "observedAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_locality_observation_subject_source_observed"`
    );
    await queryRunner.query(`DROP TABLE "locality_observation"`);
  }
}
