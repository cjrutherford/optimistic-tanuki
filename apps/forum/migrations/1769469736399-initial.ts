import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1769469736399 implements MigrationInterface {
    name = 'Initial1769469736399'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "forum_link" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" character varying NOT NULL, "title" character varying, "description" character varying, "appScope" character varying NOT NULL DEFAULT 'forum', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_289105002f3786feec23a3f20fc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "forum_post" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" character varying NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'forum', "threadId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isEdited" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_35363fad61a4ba1fb0ba562b444" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "thread" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" character varying NOT NULL, "content" character varying NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'forum', "topicId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "visibility" character varying NOT NULL DEFAULT 'public', "isPinned" boolean NOT NULL DEFAULT false, "isLocked" boolean NOT NULL DEFAULT false, "viewCount" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_cabc0f3f27d7b1c70cf64623e02" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "topic" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" character varying NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'forum', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "visibility" character varying NOT NULL DEFAULT 'public', "isPinned" boolean NOT NULL DEFAULT false, "isLocked" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_33aa4ecb4e4f20aa0157ea7ef61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "forum_post_links_forum_link" ("forumPostId" uuid NOT NULL, "forumLinkId" uuid NOT NULL, CONSTRAINT "PK_ed1053544d28022f3dfa4538c54" PRIMARY KEY ("forumPostId", "forumLinkId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_69c8f8972e9e8023e1f1cf8e95" ON "forum_post_links_forum_link" ("forumPostId") `);
        await queryRunner.query(`CREATE INDEX "IDX_beeab705fa82ea1f8c18e12789" ON "forum_post_links_forum_link" ("forumLinkId") `);
        await queryRunner.query(`ALTER TABLE "forum_post" ADD CONSTRAINT "FK_843ac34e55e7c541f89ef1e9852" FOREIGN KEY ("threadId") REFERENCES "thread"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "thread" ADD CONSTRAINT "FK_8a390281c9e6c8ad4be83400ae9" FOREIGN KEY ("topicId") REFERENCES "topic"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "forum_post_links_forum_link" ADD CONSTRAINT "FK_69c8f8972e9e8023e1f1cf8e959" FOREIGN KEY ("forumPostId") REFERENCES "forum_post"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "forum_post_links_forum_link" ADD CONSTRAINT "FK_beeab705fa82ea1f8c18e127897" FOREIGN KEY ("forumLinkId") REFERENCES "forum_link"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "forum_post_links_forum_link" DROP CONSTRAINT "FK_beeab705fa82ea1f8c18e127897"`);
        await queryRunner.query(`ALTER TABLE "forum_post_links_forum_link" DROP CONSTRAINT "FK_69c8f8972e9e8023e1f1cf8e959"`);
        await queryRunner.query(`ALTER TABLE "thread" DROP CONSTRAINT "FK_8a390281c9e6c8ad4be83400ae9"`);
        await queryRunner.query(`ALTER TABLE "forum_post" DROP CONSTRAINT "FK_843ac34e55e7c541f89ef1e9852"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_beeab705fa82ea1f8c18e12789"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69c8f8972e9e8023e1f1cf8e95"`);
        await queryRunner.query(`DROP TABLE "forum_post_links_forum_link"`);
        await queryRunner.query(`DROP TABLE "topic"`);
        await queryRunner.query(`DROP TABLE "thread"`);
        await queryRunner.query(`DROP TABLE "forum_post"`);
        await queryRunner.query(`DROP TABLE "forum_link"`);
    }

}
