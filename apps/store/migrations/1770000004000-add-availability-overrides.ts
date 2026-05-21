import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvailabilityOverrides1770000004000
  implements MigrationInterface
{
  name = 'AddAvailabilityOverrides1770000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "availability_overrides" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid, "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP NOT NULL, "mode" character varying(24) NOT NULL, "serviceType" character varying(255), "hourlyRate" numeric(10,2), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_availability_overrides_id" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "availability_overrides"`);
  }
}
