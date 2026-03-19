import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class BusinessFeatures1741773868351179 implements MigrationInterface {
  name = 'BusinessFeatures1741773868351179';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'business_pages',
      new TableColumn({
        name: 'isFeatured',
        type: 'boolean',
        default: false,
      })
    );

    await queryRunner.addColumn(
      'business_pages',
      new TableColumn({
        name: 'featuredSpotType',
        type: 'varchar',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'business_pages',
      new TableColumn({
        name: 'customSpotContent',
        type: 'text',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'business_pages',
      new TableColumn({
        name: 'customSpotImageUrl',
        type: 'varchar',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'business_pages',
      new TableColumn({
        name: 'customSpotGradient',
        type: 'varchar',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'business_pages',
      new TableColumn({
        name: 'businessThemeId',
        type: 'uuid',
        isNullable: true,
      })
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_themes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "businessPageId" uuid NOT NULL,
        "personalityId" character varying,
        "primaryColor" character varying,
        "accentColor" character varying,
        "backgroundColor" character varying,
        "customCss" text,
        "customFontFamily" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_business_themes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_business_themes_business_page" FOREIGN KEY ("businessPageId") 
          REFERENCES "business_pages"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "business_themes"`);

    await queryRunner.dropColumn('business_pages', 'businessThemeId');
    await queryRunner.dropColumn('business_pages', 'customSpotGradient');
    await queryRunner.dropColumn('business_pages', 'customSpotImageUrl');
    await queryRunner.dropColumn('business_pages', 'customSpotContent');
    await queryRunner.dropColumn('business_pages', 'featuredSpotType');
    await queryRunner.dropColumn('business_pages', 'isFeatured');
  }
}
