import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResources1768597448000 implements MigrationInterface {
  name = 'AddResources1768597448000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create resources table
    await queryRunner.query(
      `CREATE TABLE "resources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "type" character varying(50) NOT NULL, "description" text, "location" character varying(255), "capacity" integer, "amenities" json, "hourlyRate" numeric(10,2), "isActive" boolean NOT NULL DEFAULT true, "imageUrl" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f9e0e8e0e8c9c8b9e9e9e9e9e9e" PRIMARY KEY ("id"))`
    );

    // Add resourceId column to appointments table
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD "resourceId" uuid`
    );

    // Add foreign key constraint for resourceId in appointments
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_a1b2c3d4e5f6g7h8i9j0k1l2m3n4" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );

    // Make ownerId nullable in availabilities table and add resourceId
    await queryRunner.query(
      `ALTER TABLE "availabilities" ALTER COLUMN "ownerId" DROP NOT NULL`
    );

    await queryRunner.query(
      `ALTER TABLE "availabilities" ADD "resourceId" uuid`
    );

    // Add foreign key constraint for resourceId in availabilities
    await queryRunner.query(
      `ALTER TABLE "availabilities" ADD CONSTRAINT "FK_b2c3d4e5f6g7h8i9j0k1l2m3n4o5" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "availabilities" DROP CONSTRAINT "FK_b2c3d4e5f6g7h8i9j0k1l2m3n4o5"`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_a1b2c3d4e5f6g7h8i9j0k1l2m3n4"`
    );

    // Remove resourceId columns
    await queryRunner.query(
      `ALTER TABLE "availabilities" DROP COLUMN "resourceId"`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP COLUMN "resourceId"`
    );

    // Make ownerId NOT NULL again in availabilities table
    await queryRunner.query(
      `ALTER TABLE "availabilities" ALTER COLUMN "ownerId" SET NOT NULL`
    );

    // Drop resources table
    await queryRunner.query(`DROP TABLE "resources"`);
  }
}
