import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  Index,
  TableIndex,
} from 'typeorm';

export class AddBlogRole1730838000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'profile',
      new TableColumn({
        name: 'blogRole',
        type: 'varchar',
        default: "'none'",
        isNullable: false,
      })
    );
    await queryRunner.addColumn(
      'profile',
      new TableColumn({
        name: 'appScope',
        type: 'varchar',
        isNullable: true,
      })
    );
    await queryRunner.createIndex(
      'profile',
      new TableIndex({
        columnNames: ['appScope', 'userId'],
        name: 'IDX_userId_appScope',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('profile', 'IDX_userId_appScope');
    await queryRunner.dropColumn('profile', 'blogRole');
    await queryRunner.dropColumn('profile', 'appScope');
  }
}
