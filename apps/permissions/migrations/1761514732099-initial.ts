import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1761514732099 implements MigrationInterface {
    name = 'Initial1761514732099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "app_scope" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP, CONSTRAINT "UQ_a8a9e5258cdc3c0ec1df70bd0eb" UNIQUE ("name"), CONSTRAINT "PK_dde5bd1482a168632e486b5fe61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role_assignment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "appScopeId" uuid, "roleId" uuid, CONSTRAINT "PK_7e79671a8a5db18936173148cb4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "appScopeId" uuid, CONSTRAINT "UQ_ae4578dcaed5adff96595e61660" UNIQUE ("name"), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "permission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "resource" character varying NOT NULL, "action" character varying NOT NULL, "targetId" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_240853a0c3353c25fb12434ad33" UNIQUE ("name"), CONSTRAINT "PK_3b8b97af9d9d8807e41e6f48362" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "app_scope_permissions" ("app_scope_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "PK_093553f12b5382646f85fd74a1e" PRIMARY KEY ("app_scope_id", "permission_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8b8691ea83e746543a8d60fdbc" ON "app_scope_permissions" ("app_scope_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ddb46c1e8127c19f9223a645b0" ON "app_scope_permissions" ("permission_id") `);
        await queryRunner.query(`CREATE TABLE "role_permissions" ("role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "PK_25d24010f53bb80b78e412c9656" PRIMARY KEY ("role_id", "permission_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_178199805b901ccd220ab7740e" ON "role_permissions" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_17022daf3f885f7d35423e9971" ON "role_permissions" ("permission_id") `);
        await queryRunner.query(`ALTER TABLE "role_assignment" ADD CONSTRAINT "FK_eab9bd9ada0a03e50205626a350" FOREIGN KEY ("appScopeId") REFERENCES "app_scope"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_assignment" ADD CONSTRAINT "FK_f0de67fd09cd3cd0aabca79994d" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role" ADD CONSTRAINT "FK_7a87fe631904c7cd24137fd3495" FOREIGN KEY ("appScopeId") REFERENCES "app_scope"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "app_scope_permissions" ADD CONSTRAINT "FK_8b8691ea83e746543a8d60fdbc7" FOREIGN KEY ("app_scope_id") REFERENCES "app_scope"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "app_scope_permissions" ADD CONSTRAINT "FK_ddb46c1e8127c19f9223a645b05" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`);
        await queryRunner.query(`ALTER TABLE "app_scope_permissions" DROP CONSTRAINT "FK_ddb46c1e8127c19f9223a645b05"`);
        await queryRunner.query(`ALTER TABLE "app_scope_permissions" DROP CONSTRAINT "FK_8b8691ea83e746543a8d60fdbc7"`);
        await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "FK_7a87fe631904c7cd24137fd3495"`);
        await queryRunner.query(`ALTER TABLE "role_assignment" DROP CONSTRAINT "FK_f0de67fd09cd3cd0aabca79994d"`);
        await queryRunner.query(`ALTER TABLE "role_assignment" DROP CONSTRAINT "FK_eab9bd9ada0a03e50205626a350"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_17022daf3f885f7d35423e9971"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_178199805b901ccd220ab7740e"`);
        await queryRunner.query(`DROP TABLE "role_permissions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ddb46c1e8127c19f9223a645b0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b8691ea83e746543a8d60fdbc"`);
        await queryRunner.query(`DROP TABLE "app_scope_permissions"`);
        await queryRunner.query(`DROP TABLE "permission"`);
        await queryRunner.query(`DROP TABLE "role"`);
        await queryRunner.query(`DROP TABLE "role_assignment"`);
        await queryRunner.query(`DROP TABLE "app_scope"`);
    }

}
