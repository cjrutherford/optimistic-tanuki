import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1730000000000 implements MigrationInterface {
    name = 'Initial1730000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "permission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "resource" character varying NOT NULL, "action" character varying NOT NULL, "targetId" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_permission_name" UNIQUE ("name"), CONSTRAINT "PK_permission" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "appScope" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_role_name" UNIQUE ("name"), CONSTRAINT "PK_role" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role_assignment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" character varying NOT NULL, "appScope" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "roleId" uuid, CONSTRAINT "PK_role_assignment" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role_permissions" ("role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_role_permissions_role" ON "role_permissions" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_role_permissions_permission" ON "role_permissions" ("permission_id") `);
        await queryRunner.query(`ALTER TABLE "role_assignment" ADD CONSTRAINT "FK_role_assignment_role" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_role_permissions_permission"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_role_permissions_role"`);
        await queryRunner.query(`ALTER TABLE "role_assignment" DROP CONSTRAINT "FK_role_assignment_role"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_role_permissions_permission"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_role_permissions_role"`);
        await queryRunner.query(`DROP TABLE "role_permissions"`);
        await queryRunner.query(`DROP TABLE "role_assignment"`);
        await queryRunner.query(`DROP TABLE "role"`);
        await queryRunner.query(`DROP TABLE "permission"`);
    }
}
