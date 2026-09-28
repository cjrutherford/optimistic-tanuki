import { parseTaxSchedule } from './tax-schedule.parser';

const SCHEDULE_C_TABULAR = `Schedule C (Form 1040) 2024
Filer: Delacroix Fabrication LLC

Part I - Income
1  Gross receipts or sales                    1,284,500.00
2  Returns and allowances                         (1,200.00)
3  Gross profit                              1,283,300.00

Part II - Expenses
9  Car and truck expenses                        18,400.00
10 Depreciation                                     9,120.00
17 Utilities                                          4,310.75
22 Advertising                                  (see attached)
25 Total expenses                                47,310.55

Part III - Net Profit
31 Net profit                                1,235,989.45
`;

const SCHEDULE_C_PIPED = `Schedule C (Form 1040), Part I, Line 1 | Gross receipts or sales | 1,284,500.00
Schedule C (Form 1040), Part I, Line 2 | Returns and allowances | (1,200.00)
Schedule C (Form 1040), Part I, Line 3 | Gross profit | 1,283,300.00
Schedule C (Form 1040), Part II, Line 25 | Total expenses | 47,310.55
Schedule C (Form 1040), Part III, Line 31 | Net profit | 1,235,989.45
`;

describe('parseTaxSchedule', () => {
  describe('a Schedule C read off a tabular page', () => {
    const parsed = parseTaxSchedule(SCHEDULE_C_TABULAR);

    it('reads the form, the tax year, and the filer off the header', () => {
      expect(parsed.form).toBe('Schedule C');
      expect(parsed.taxYear).toBe(2024);
      expect(parsed.filerName).toBe('Delacroix Fabrication LLC');
    });

    it('reads every priced line with its number, label, part, and amount', () => {
      expect(parsed.lineItems).toEqual([
        {
          partNumber: 1,
          partLabel: 'Part I - Income',
          lineRef: '1',
          line: 1,
          label: 'Gross receipts or sales',
          amount: 1284500,
        },
        {
          partNumber: 1,
          partLabel: 'Part I - Income',
          lineRef: '2',
          line: 2,
          label: 'Returns and allowances',
          amount: -1200,
        },
        {
          partNumber: 1,
          partLabel: 'Part I - Income',
          lineRef: '3',
          line: 3,
          label: 'Gross profit',
          amount: 1283300,
        },
        {
          partNumber: 2,
          partLabel: 'Part II - Expenses',
          lineRef: '9',
          line: 9,
          label: 'Car and truck expenses',
          amount: 18400,
        },
        {
          partNumber: 2,
          partLabel: 'Part II - Expenses',
          lineRef: '10',
          line: 10,
          label: 'Depreciation',
          amount: 9120,
        },
        {
          partNumber: 2,
          partLabel: 'Part II - Expenses',
          lineRef: '17',
          line: 17,
          label: 'Utilities',
          amount: 4310.75,
        },
        {
          partNumber: 2,
          partLabel: 'Part II - Expenses',
          lineRef: '25',
          line: 25,
          label: 'Total expenses',
          amount: 47310.55,
        },
        {
          partNumber: 3,
          partLabel: 'Part III - Net Profit',
          lineRef: '31',
          line: 31,
          label: 'Net profit',
          amount: 1235989.45,
        },
      ]);
    });

    it('reports the amounts the schedule printed rather than a sum of the excerpt', () => {
      expect(parsed.reportedTotals).toEqual({
        grossIncome: 1283300,
        totalExpenses: 47310.55,
        netProfit: 1235989.45,
      });
    });

    it('confirms the printed net profit against the printed totals', () => {
      expect(parsed.reconciliation).toEqual({
        consistent: true,
        reportedNetProfit: 1235989.45,
        computedNetProfit: 1235989.45,
        difference: 0,
      });
    });

    it('keeps a line it could not price in unparsedLines instead of guessing zero', () => {
      expect(parsed.unparsedLines).toEqual([
        { lineRef: '22', text: '22 Advertising (see attached)' },
      ]);
    });
  });

  describe('the same schedule read off a pipe-delimited extraction', () => {
    const parsed = parseTaxSchedule(SCHEDULE_C_PIPED);

    it('produces the same line items and totals as the tabular page', () => {
      expect(parsed.lineItems.map((item) => [item.line, item.amount])).toEqual([
        [1, 1284500],
        [2, -1200],
        [3, 1283300],
        [25, 47310.55],
        [31, 1235989.45],
      ]);
      expect(parsed.reportedTotals).toEqual({
        grossIncome: 1283300,
        totalExpenses: 47310.55,
        netProfit: 1235989.45,
      });
      expect(parsed.reconciliation.consistent).toBe(true);
    });
  });

  describe('amount reading', () => {
    it.each([
      ['$1,234.56', 1234.56],
      ['(1,234.56)', -1234.56],
      ['1,234.56-', -1234.56],
      ['-$1,234.56', -1234.56],
      ['(1,234)', -1234],
      ['0.00', 0],
    ])('reads %s as %s', (printed, expected) => {
      const parsed = parseTaxSchedule(`1 Widgets ${printed}`);
      expect(parsed.lineItems[0].amount).toBe(expected);
    });
  });

  describe('a schedule that does not add up', () => {
    it('says so rather than adjusting a printed figure to make it fit', () => {
      const parsed = parseTaxSchedule(
        [
          'Schedule C (Form 1040) 2024',
          'Part I - Income',
          '3  Gross profit        1,283,300.00',
          'Part II - Expenses',
          '25 Total expenses        47,310.55',
          'Part III - Net Profit',
          '31 Net profit        1,240,000.00',
        ].join('\n')
      );

      expect(parsed.reportedTotals.netProfit).toBe(1240000);
      expect(parsed.reconciliation.consistent).toBe(false);
      expect(parsed.reconciliation.computedNetProfit).toBe(1235989.45);
      expect(parsed.reconciliation.difference).toBe(4010.55);
    });
  });

  describe('Form 1040 proper', () => {
    it('reads adjusted gross income as the income total and nothing more', () => {
      const parsed = parseTaxSchedule(
        [
          'Form 1040 (2024)',
          'Filer: R. Delacroix',
          '1a  W-2 wages and salaries                92,000.00',
          '11  Adjusted gross income                88,400.00',
          '16  Tax                                   8,412.00',
        ].join('\n')
      );

      expect(parsed.form).toBe('Form 1040');
      expect(parsed.reportedTotals).toEqual({
        grossIncome: 88400,
        totalExpenses: null,
        netProfit: null,
      });
      expect(parsed.lineItems).toHaveLength(3);
      expect(parsed.lineItems[0]).toEqual({
        partNumber: null,
        partLabel: null,
        lineRef: '1a',
        line: 1,
        label: 'W-2 wages and salaries',
        amount: 92000,
      });
    });

    it('withholds an opinion when the page does not carry enough to compare', () => {
      const parsed = parseTaxSchedule('1  W-2 wages and salaries  92,000.00');
      expect(parsed.reconciliation.consistent).toBeNull();
      expect(parsed.reconciliation.computedNetProfit).toBeNull();
      expect(parsed.reconciliation.difference).toBeNull();
    });
  });

  describe('input the parser cannot read', () => {
    it('returns an empty result rather than throwing', () => {
      const parsed = parseTaxSchedule('');
      expect(parsed.lineItems).toEqual([]);
      expect(parsed.unparsedLines).toEqual([]);
      expect(parsed.form).toBeNull();
      expect(parsed.taxYear).toBeNull();
      expect(parsed.reportedTotals).toEqual({
        grossIncome: null,
        totalExpenses: null,
        netProfit: null,
      });
      expect(parsed.reconciliation.consistent).toBeNull();
    });

    it('does not mistake a part heading or a total line for a priced line item', () => {
      const parsed = parseTaxSchedule(
        ['Part I - Income', 'Total                1,000.00'].join('\n')
      );
      expect(parsed.lineItems).toEqual([]);
    });

    it('keeps a numbered line with no label in unparsedLines', () => {
      const parsed = parseTaxSchedule('7              500.00');
      expect(parsed.lineItems).toEqual([]);
      expect(parsed.unparsedLines).toEqual([
        { lineRef: '7', text: '7 500.00' },
      ]);
    });
  });
});
