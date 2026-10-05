import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDaylightAlerts1791165718816 implements MigrationInterface {
  name = 'AddDaylightAlerts1791165718816';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "daylight_alerts" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "kind" character varying NOT NULL, "localitySlug" character varying NOT NULL, "detail" text NOT NULL, "firstSeenAt" character varying NOT NULL, "notifiedAt" character varying, "resolvedAt" character varying, CONSTRAINT "PK_59d121c5684bafbd30e594fdb4d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_16fd5bb1e8311777c39d2443f4" ON "daylight_alerts" ("key", "resolvedAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_16fd5bb1e8311777c39d2443f4"`
    );
    await queryRunner.query(`DROP TABLE "daylight_alerts"`);
  }
}
