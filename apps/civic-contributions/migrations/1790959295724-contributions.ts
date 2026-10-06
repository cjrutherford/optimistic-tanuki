import { MigrationInterface, QueryRunner } from 'typeorm';

export class Contributions1790959295724 implements MigrationInterface {
  name = 'Contributions1790959295724';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "contributors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "profileId" uuid NOT NULL, "handle" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "suspendedAt" TIMESTAMP WITH TIME ZONE, "suspendedReason" text, "officialStanding" text NOT NULL DEFAULT 'none', "officialLocality" text, "officialOffice" text, CONSTRAINT "PK_c94ff4e6bca235dc30625c92c90" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_77ac92fcca871f17d089d107b2" ON "contributors" ("userId") `
    );
    await queryRunner.query(
      `CREATE TABLE "contributions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "contributorId" uuid NOT NULL, "localitySlug" text NOT NULL, "kind" text NOT NULL, "subjectKind" text NOT NULL, "subjectRef" text, "subjectText" text NOT NULL, "occurredOn" date, "body" text NOT NULL, "bodySha256" text NOT NULL, "links" jsonb NOT NULL, "disclosedInterest" text, "topic" text NOT NULL DEFAULT 'government', "representations" jsonb NOT NULL, "artifactId" uuid, "officialStanding" text, "state" text NOT NULL, "submittedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idempotencyKey" text, "originNetwork" text, "originClient" text, CONSTRAINT "PK_ca2b4f39eb9e32a61278c711f79" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20204d4b705d1e56c6e83acb4b" ON "contributions" ("contributorId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dd9f48057d5776d388a27e40fb" ON "contributions" ("localitySlug") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_798adf2bf4634f0199ca0cdc53" ON "contributions" ("state") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_62dab07dd48263c2bb65df165c" ON "contributions" ("submittedAt") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_07d3bfa552fdb2312f8e551416" ON "contributions" ("contributorId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE TABLE "artifacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sha256" text NOT NULL, "mediaType" text NOT NULL, "bytes" integer NOT NULL, "storagePath" text NOT NULL, "scanner" text NOT NULL, "scannedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "firstContributorId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6516bbed3c129918e05c5012edb" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_397689a166d04ea82118a1f666" ON "artifacts" ("sha256") `
    );
    await queryRunner.query(
      `CREATE TABLE "review_decisions" ("id" SERIAL NOT NULL, "contributionId" uuid NOT NULL, "stage" text NOT NULL, "outcome" text NOT NULL, "reasons" jsonb NOT NULL, "model" text, "promptSha256" text, "answers" jsonb, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1fb0883c5b1ef83c015f2ab3b24" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_25eb135cb85f7a8ed42f4f824a" ON "review_decisions" ("contributionId") `
    );
    await queryRunner.query(
      `CREATE TABLE "official_events" ("id" SERIAL NOT NULL, "contributorId" uuid NOT NULL, "kind" text NOT NULL, "localitySlug" text NOT NULL, "detail" jsonb NOT NULL, "by" text NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_340064152d825e7311f21b27780" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b796c2f0f8a714ae4fdd602fea" ON "official_events" ("contributorId") `
    );
    await queryRunner.query(
      `CREATE TABLE "takedown_notices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "claimantName" text NOT NULL, "claimantEmail" text NOT NULL, "claimantAddress" text NOT NULL, "work" text NOT NULL, "locations" jsonb NOT NULL, "goodFaith" boolean NOT NULL, "accurateUnderPenalty" boolean NOT NULL, "signature" text NOT NULL, "state" text NOT NULL DEFAULT 'received', "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c872c34e170d36e0ace7bd95287" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f45749474cbd604ea126a45fc5" ON "takedown_notices" ("state") `
    );
    await queryRunner.query(
      `CREATE TABLE "takedown_actions" ("id" SERIAL NOT NULL, "noticeId" uuid NOT NULL, "action" text NOT NULL, "contributionIds" jsonb NOT NULL, "by" text NOT NULL, "note" text NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0553a37d6d05b62f3fc440f78b9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a184600abe5590c95fdccb262f" ON "takedown_actions" ("noticeId") `
    );
    await queryRunner.query(
      `CREATE TABLE "counter_notices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "noticeId" uuid NOT NULL, "contributionId" uuid NOT NULL, "contributorId" uuid NOT NULL, "statement" text NOT NULL, "consentToJurisdiction" boolean NOT NULL, "underPenalty" boolean NOT NULL, "signature" text NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2fe31d52f4c6767ee7c452b24b9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9b924fbde616205a5aa938a2e5" ON "counter_notices" ("noticeId") `
    );
    await queryRunner.query(
      `CREATE TABLE "copyright_strikes" ("id" SERIAL NOT NULL, "contributorId" uuid NOT NULL, "noticeId" uuid NOT NULL, "contributionId" uuid NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_657f3d4c1a88dde3d7cc7b2f9c1" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_abdfec4c458a8fd613110aabcb" ON "copyright_strikes" ("contributorId") `
    );
    await queryRunner.query(
      `CREATE TABLE "gate_events" ("id" SERIAL NOT NULL, "reportId" uuid NOT NULL, "status" text NOT NULL, "mass" real NOT NULL, "members" jsonb NOT NULL, "cause" text NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bcd0007d69dd29603b48bdd06c7" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41ca75385357187bfe526aae7c" ON "gate_events" ("reportId") `
    );
    await queryRunner.query(
      `CREATE TABLE "outcome_matches" ("id" SERIAL NOT NULL, "contributionId" uuid NOT NULL, "recordKind" text NOT NULL, "recordRef" text NOT NULL, "recordTitle" text NOT NULL, "recordDate" date, "recordUrl" text, "recordPublisher" text, "verdict" text NOT NULL, "reasons" jsonb NOT NULL, "model" text, "promptSha256" text, "answers" jsonb, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d798efeb50af157d9505c42b0e2" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_967d6bf96b8df0ebd98cf28a40" ON "outcome_matches" ("contributionId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d9b7fe7c6c22ecb3d510f9bc0" ON "outcome_matches" ("verdict") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8fa74a826f4161baf298aa21bf" ON "outcome_matches" ("contributionId", "recordRef") `
    );
    await queryRunner.query(
      `CREATE TABLE "reputation_events" ("id" SERIAL NOT NULL, "contributorId" uuid NOT NULL, "topic" text NOT NULL, "delta" real NOT NULL, "kind" text NOT NULL, "contributionId" uuid, "outcomeMatchId" integer, "reason" text NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_27bf0668993ad863b678979548a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e8c0ecb7daab370dcf38b2b65" ON "reputation_events" ("contributorId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c20693311c70de72317abc534f" ON "reputation_events" ("topic") `
    );
    await queryRunner.query(
      `CREATE TABLE "promotion_events" ("id" SERIAL NOT NULL, "contributionId" uuid NOT NULL, "localitySlug" text NOT NULL, "offered" boolean NOT NULL, "path" text, "reason" text NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_49924dc4d0f1b7b145f863873c9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_16519f9fa09a38c5ce22d6039d" ON "promotion_events" ("contributionId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_79e7c3be45eb1baf0f0d1d735e" ON "promotion_events" ("localitySlug") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_79e7c3be45eb1baf0f0d1d735e"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_16519f9fa09a38c5ce22d6039d"`
    );
    await queryRunner.query(`DROP TABLE "promotion_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c20693311c70de72317abc534f"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2e8c0ecb7daab370dcf38b2b65"`
    );
    await queryRunner.query(`DROP TABLE "reputation_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8fa74a826f4161baf298aa21bf"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9d9b7fe7c6c22ecb3d510f9bc0"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_967d6bf96b8df0ebd98cf28a40"`
    );
    await queryRunner.query(`DROP TABLE "outcome_matches"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_41ca75385357187bfe526aae7c"`
    );
    await queryRunner.query(`DROP TABLE "gate_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_abdfec4c458a8fd613110aabcb"`
    );
    await queryRunner.query(`DROP TABLE "copyright_strikes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9b924fbde616205a5aa938a2e5"`
    );
    await queryRunner.query(`DROP TABLE "counter_notices"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a184600abe5590c95fdccb262f"`
    );
    await queryRunner.query(`DROP TABLE "takedown_actions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f45749474cbd604ea126a45fc5"`
    );
    await queryRunner.query(`DROP TABLE "takedown_notices"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b796c2f0f8a714ae4fdd602fea"`
    );
    await queryRunner.query(`DROP TABLE "official_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_25eb135cb85f7a8ed42f4f824a"`
    );
    await queryRunner.query(`DROP TABLE "review_decisions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_397689a166d04ea82118a1f666"`
    );
    await queryRunner.query(`DROP TABLE "artifacts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_07d3bfa552fdb2312f8e551416"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_62dab07dd48263c2bb65df165c"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_798adf2bf4634f0199ca0cdc53"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dd9f48057d5776d388a27e40fb"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_20204d4b705d1e56c6e83acb4b"`
    );
    await queryRunner.query(`DROP TABLE "contributions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_77ac92fcca871f17d089d107b2"`
    );
    await queryRunner.query(`DROP TABLE "contributors"`);
  }
}
