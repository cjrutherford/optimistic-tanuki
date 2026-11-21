import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryRightsPolicyResolved1794979279221
  implements MigrationInterface
{
  name = 'DirectoryRightsPolicyResolved1794979279221';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_rights_event" DROP CONSTRAINT "CHK_directory_rights_event_action"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_rights_event" ADD CONSTRAINT "CHK_directory_rights_event_action_v2" CHECK ("action" IN ('open','exclude_field','confirm_terms','defer','reopen','undo','withdraw','policy_resolved'))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_rights_event" DROP CONSTRAINT "CHK_directory_rights_event_action_v2"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_rights_event" ADD CONSTRAINT "CHK_directory_rights_event_action" CHECK (((action)::text = ANY ((ARRAY['open'::character varying, 'exclude_field'::character varying, 'confirm_terms'::character varying, 'defer'::character varying, 'reopen'::character varying, 'undo'::character varying, 'withdraw'::character varying])::text[])))`
    );
  }
}
