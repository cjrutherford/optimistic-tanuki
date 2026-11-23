import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegistryDurability1795411571917 implements MigrationInterface {
  name = 'AddRegistryDurability1795411571917';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "registry_audit" ("id" SERIAL NOT NULL, "action" character varying(32) NOT NULL, "actor" character varying(256) NOT NULL, "summary" text NOT NULL, "reason" text, "releaseVersion" integer, "before" jsonb, "after" jsonb, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_eb87d51182db44fa2e76f685d42" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_544f301a5a6fe67dfd98ea6b50" ON "registry_audit" ("createdAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "registry_entry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(16) NOT NULL, "key" character varying(256) NOT NULL, "definition" jsonb NOT NULL, "position" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0fa32addadece3eaf914608000b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a23cc168baa4d66998da66321c" ON "registry_entry" ("kind", "key") `
    );
    await queryRunner.query(
      `CREATE TABLE "registry_release" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "version" integer NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'published', "isCurrent" boolean NOT NULL DEFAULT false, "snapshot" jsonb NOT NULL, "releaseNotes" text NOT NULL DEFAULT '', "changeSummary" text, "sourceHash" character varying(64), "restoredFromVersion" integer, "publishedAt" TIMESTAMP WITH TIME ZONE, "publishedBy" character varying(256), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a05961a81a4b39d9bd53330706c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3924df5ae0762f4a12dce450a8" ON "registry_release" ("version") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3924df5ae0762f4a12dce450a8"`
    );
    await queryRunner.query(`DROP TABLE "registry_release"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a23cc168baa4d66998da66321c"`
    );
    await queryRunner.query(`DROP TABLE "registry_entry"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_544f301a5a6fe67dfd98ea6b50"`
    );
    await queryRunner.query(`DROP TABLE "registry_audit"`);
  }
}
