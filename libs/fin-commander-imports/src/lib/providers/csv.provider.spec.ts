import { csvImportProvider, parseAmountToCents } from './csv.provider';

describe('parseAmountToCents', () => {
  it('parses whole-dollar strings into integer cents', () => {
    expect(parseAmountToCents('1000')).toBe(100000);
  });

  it('parses fractional-dollar strings into integer cents without float drift', () => {
    expect(parseAmountToCents('84.52')).toBe(8452);
    expect(parseAmountToCents('5.5')).toBe(550);
    // 19.99 * 100 famously drifts to 1998.9999 as a float; rounding fixes it.
    expect(parseAmountToCents('19.99')).toBe(1999);
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseAmountToCents('  12.34  ')).toBe(1234);
  });

  it('guards NaN and empty input by returning 0 cents', () => {
    expect(parseAmountToCents('not-a-number')).toBe(0);
    expect(parseAmountToCents('')).toBe(0);
    expect(parseAmountToCents(undefined)).toBe(0);
  });
});

describe('csvImportProvider', () => {
  it('produces integer-cents amounts for each parsed row', async () => {
    const preview = await csvImportProvider.preview(
      [
        'date,description,amount,type,category',
        '2026-04-11,Neighborhood Market,84.52,debit,Groceries',
        '2026-04-12,Client payment,1500,credit,Income',
      ].join('\n')
    );

    expect(preview.transactions).toHaveLength(2);
    expect(preview.transactions[0].amountCents).toBe(8452);
    expect(preview.transactions[1].amountCents).toBe(150000);
    for (const transaction of preview.transactions) {
      expect(Number.isInteger(transaction.amountCents)).toBe(true);
    }
  });

  it('imports malformed amounts as 0 cents rather than NaN', async () => {
    const preview = await csvImportProvider.preview(
      [
        'date,description,amount,type,category',
        '2026-04-11,Bad row,,debit,X',
      ].join('\n')
    );

    expect(preview.transactions[0].amountCents).toBe(0);
  });
});
