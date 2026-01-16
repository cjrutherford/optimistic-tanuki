import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppointments1768577573000 implements MigrationInterface {
  name = 'AddAppointments1768577573000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "availabilities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "dayOfWeek" integer NOT NULL, "startTime" time NOT NULL, "endTime" time NOT NULL, "hourlyRate" numeric(10,2) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "serviceType" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3968df6b95e833eda7bea0bccd" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "productId" uuid, "title" character varying(255) NOT NULL, "description" text, "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'pending', "isFreeConsultation" boolean NOT NULL DEFAULT false, "hourlyRate" numeric(10,2), "totalCost" numeric(10,2), "notes" text, "denialReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "appointmentId" uuid NOT NULL, "userId" uuid NOT NULL, "invoiceNumber" character varying(100) NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "status" character varying(50) NOT NULL DEFAULT 'unpaid', "paidAt" TIMESTAMP, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_6a5f9c72b2e7c525e1c06ba6308" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_96249fef9ab22c3a7f5b6c8d7c0" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_96249fef9ab22c3a7f5b6c8d7c0"`
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_6a5f9c72b2e7c525e1c06ba6308"`
    );
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "appointments"`);
    await queryRunner.query(`DROP TABLE "availabilities"`);
  }
}
