import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converts store money columns from `decimal(10,2)` dollars to integer cents
 * to eliminate floating-point accumulation error in order totals and other
 * money math. Existing values are converted losslessly via
 * ROUND(value * 100)::int — decimal(10,2) values have at most 2 fractional
 * digits, so multiplying by 100 always yields a whole number and ROUND only
 * guards against any residual binary floating-point representation noise.
 */
export class ConvertMoneyColumnsToCents1770000011000
  implements MigrationInterface
{
  name = 'ConvertMoneyColumnsToCents1770000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // products.price -> products.priceCents
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "priceCents" integer`
    );
    await queryRunner.query(
      `UPDATE "products" SET "priceCents" = ROUND("price" * 100)::int`
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "priceCents" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "price"`);

    // order_items.price -> order_items.unitPriceCents
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN "unitPriceCents" integer`
    );
    await queryRunner.query(
      `UPDATE "order_items" SET "unitPriceCents" = ROUND("price" * 100)::int`
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ALTER COLUMN "unitPriceCents" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "price"`);

    // orders.total -> orders.totalCents
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN "totalCents" integer`
    );
    await queryRunner.query(
      `UPDATE "orders" SET "totalCents" = ROUND("total" * 100)::int`
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "totalCents" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "total"`);

    // donations.amount -> donations.amountCents
    await queryRunner.query(
      `ALTER TABLE "donations" ADD COLUMN "amountCents" integer`
    );
    await queryRunner.query(
      `UPDATE "donations" SET "amountCents" = ROUND("amount" * 100)::int`
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "amountCents" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "amount"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // donations.amountCents -> donations.amount
    await queryRunner.query(
      `ALTER TABLE "donations" ADD COLUMN "amount" numeric(10,2)`
    );
    await queryRunner.query(
      `UPDATE "donations" SET "amount" = "amountCents"::numeric / 100`
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "amount" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "amountCents"`
    );

    // orders.totalCents -> orders.total
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN "total" numeric(10,2)`
    );
    await queryRunner.query(
      `UPDATE "orders" SET "total" = "totalCents"::numeric / 100`
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "total" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "totalCents"`);

    // order_items.unitPriceCents -> order_items.price
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN "price" numeric(10,2)`
    );
    await queryRunner.query(
      `UPDATE "order_items" SET "price" = "unitPriceCents"::numeric / 100`
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ALTER COLUMN "price" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN "unitPriceCents"`
    );

    // products.priceCents -> products.price
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "price" numeric(10,2)`
    );
    await queryRunner.query(
      `UPDATE "products" SET "price" = "priceCents"::numeric / 100`
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "price" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "priceCents"`);
  }
}
