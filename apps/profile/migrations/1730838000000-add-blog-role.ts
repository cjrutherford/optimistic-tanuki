import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddBlogRole1730838000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('profile', new TableColumn({
            name: 'blogRole',
            type: 'varchar',
            default: "'none'",
            isNullable: false,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('profile', 'blogRole');
    }
}
