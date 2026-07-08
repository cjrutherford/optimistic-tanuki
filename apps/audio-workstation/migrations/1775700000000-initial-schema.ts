import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1775700000000 implements MigrationInterface {
  name = 'InitialSchema1775700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audio_projects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "bpm" integer NOT NULL DEFAULT 120,
        "key" character varying NOT NULL DEFAULT 'C',
        "timeSignature" character varying NOT NULL DEFAULT '4/4',
        "genre" character varying,
        "mood" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audio_projects" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tracks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "type" character varying(20) NOT NULL,
        "assetId" character varying,
        "volume" double precision NOT NULL DEFAULT 0,
        "pan" double precision NOT NULL DEFAULT 0,
        "muted" boolean NOT NULL DEFAULT false,
        "solo" boolean NOT NULL DEFAULT false,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "startOffset" double precision NOT NULL DEFAULT 0,
        "waveformDataUrl" character varying,
        CONSTRAINT "PK_tracks" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "arrangement_sections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "label" character varying NOT NULL,
        "barStart" integer NOT NULL,
        "barLength" integer NOT NULL,
        "trackOrder" text NOT NULL DEFAULT '',
        CONSTRAINT "PK_arrangement_sections" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "mix_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "trackId" uuid NOT NULL,
        "volume" double precision NOT NULL,
        "pan" double precision NOT NULL,
        "eq" jsonb NOT NULL DEFAULT '{}',
        "dynamics" jsonb NOT NULL DEFAULT '{}',
        "effects" jsonb NOT NULL DEFAULT '{}',
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mix_snapshots" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_generation_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "collaborationMode" character varying(20) NOT NULL DEFAULT 'full-auto',
        "agentType" character varying(20) NOT NULL,
        "prompt" text NOT NULL,
        "parameters" jsonb NOT NULL DEFAULT '{}',
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "resultAssetId" character varying,
        "voiceMemoAssetId" character varying,
        "referenceTrackAssetId" character varying,
        "errorMessage" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        CONSTRAINT "PK_ai_generation_requests" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "export_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "format" character varying(10) NOT NULL,
        "quality" character varying(20) NOT NULL DEFAULT 'high',
        "bitrate" integer,
        "bitDepth" integer,
        "sampleRate" integer,
        "includeStems" boolean NOT NULL DEFAULT false,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "resultAssetId" character varying,
        "errorMessage" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        CONSTRAINT "PK_export_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "tracks"
        ADD CONSTRAINT "FK_tracks_project" FOREIGN KEY ("projectId")
        REFERENCES "audio_projects"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "arrangement_sections"
        ADD CONSTRAINT "FK_arrangement_sections_project" FOREIGN KEY ("projectId")
        REFERENCES "audio_projects"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "mix_snapshots"
        ADD CONSTRAINT "FK_mix_snapshots_project" FOREIGN KEY ("projectId")
        REFERENCES "audio_projects"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_generation_requests"
        ADD CONSTRAINT "FK_ai_generation_requests_project" FOREIGN KEY ("projectId")
        REFERENCES "audio_projects"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tracks_projectId" ON "tracks" ("projectId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ai_generation_requests_projectId" ON "ai_generation_requests" ("projectId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_export_jobs_projectId" ON "export_jobs" ("projectId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_export_jobs_projectId"`);
    await queryRunner.query(
      `DROP INDEX "IDX_ai_generation_requests_projectId"`
    );
    await queryRunner.query(`DROP INDEX "IDX_tracks_projectId"`);
    await queryRunner.query(
      `ALTER TABLE "ai_generation_requests" DROP CONSTRAINT "FK_ai_generation_requests_project"`
    );
    await queryRunner.query(
      `ALTER TABLE "mix_snapshots" DROP CONSTRAINT "FK_mix_snapshots_project"`
    );
    await queryRunner.query(
      `ALTER TABLE "arrangement_sections" DROP CONSTRAINT "FK_arrangement_sections_project"`
    );
    await queryRunner.query(
      `ALTER TABLE "tracks" DROP CONSTRAINT "FK_tracks_project"`
    );
    await queryRunner.query(`DROP TABLE "export_jobs"`);
    await queryRunner.query(`DROP TABLE "ai_generation_requests"`);
    await queryRunner.query(`DROP TABLE "mix_snapshots"`);
    await queryRunner.query(`DROP TABLE "arrangement_sections"`);
    await queryRunner.query(`DROP TABLE "tracks"`);
    await queryRunner.query(`DROP TABLE "audio_projects"`);
  }
}
