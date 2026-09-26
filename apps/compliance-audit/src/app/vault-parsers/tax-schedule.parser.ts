import {
  ParsedTaxSchedule,
  TaxScheduleLineItem,
  TaxScheduleUnparsedLine,
} from '@optimistic-tanuki/models';

const ROMAN: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

const PART_HEADING = /^Part\s+([IVXLC]+)\b\s*[—–:-]?\s*(.*)$/i;
const PIPED_LINE =
  /^\s*([^,|]+),\s*Part\s+([IVXLC]+)(?:\s*[—–:-]\s*([^|]+?))?\s*,\s*Line\s+(\d{1,3})\s*\|\s*(.+?)\s*\|\s*(\S.*?)\s*$/i;
const FORM_HEADER = /\b(Schedule\s+([A-Z])|Form\s+1040)\b/i;
const FILER_LINE = /^(?:Filer|Taxpayer|Prepared\s+for)\s*[:.]?\s*(.+)$/i;
const TRAILING_AMOUNT = /(\(?-?\$?\d[\d,]*(?:\.\d{1,2})?\)?-?)\s*$/;
const NUMBERED_LINE = /^(\d{1,3}[A-Za-z]?)\s{1,}(.*)$/;

const GROSS_INCOME = /^(adjusted\s+)?gross\s+(income|profit)\b/i;
const TOTAL_EXPENSES = /^total\s+expenses\b/i;
const NET_RESULT = /^net\s+(profit|income|loss|earnings)\b/i;

const toCents = (value: number): number => Math.round(value * 100);

const squeeze = (value: string): string => value.replace(/\s+/g, ' ').trim();

const parseAmount = (printed: string): number | null => {
  const trimmed = printed.trim();
  if (!trimmed) {
    return null;
  }
  const parenthesised = trimmed.startsWith('(') && trimmed.endsWith(')');
  const trailingMinus = trimmed.endsWith('-');
  const leadingMinus = trimmed.startsWith('-');
  const digits = trimmed.replace(/[^0-9.]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) {
    return null;
  }
  const magnitude = Number(digits);
  if (!Number.isFinite(magnitude)) {
    return null;
  }
  return parenthesised || trailingMinus || leadingMinus
    ? -magnitude
    : magnitude;
};

/**
 * Reads a tax schedule into priced lines.
 *
 * The arithmetic is deliberately not done here. Summing an excerpt of a
 * Schedule C gives a total that looks authoritative and is wrong, because the
 * form has expense lines this page may never have shown. So the parser reports
 * the figures the schedule printed, and separately states whether those
 * printed figures are consistent with each other. A reviewer sees the
 * discrepancy instead of a number that was quietly manufactured to make it
 * balance.
 *
 * A numbered line with no amount is not treated as zero. It goes to
 * `unparsedLines`, because a line that was not read is a gap in the evidence
 * and zero is a claim.
 */
export const parseTaxSchedule = (text: string): ParsedTaxSchedule => {
  const lineItems: TaxScheduleLineItem[] = [];
  const unparsedLines: TaxScheduleUnparsedLine[] = [];
  let form: string | null = null;
  let taxYear: number | null = null;
  let filerName: string | null = null;
  let partNumber: number | null = null;
  let partLabel: string | null = null;

  if (typeof text === 'string' && text.trim()) {
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const part = PART_HEADING.exec(line);
      if (part) {
        partNumber = ROMAN[part[1].toUpperCase()] ?? null;
        partLabel = line;
        continue;
      }

      const piped = PIPED_LINE.exec(line);
      if (piped) {
        const amount = parseAmount(piped[6]);
        if (amount === null) {
          unparsedLines.push({ lineRef: piped[4], text: squeeze(line) });
          continue;
        }
        if (!form) {
          form = normalizeForm(piped[1], text);
        }
        lineItems.push({
          partNumber: ROMAN[piped[2].toUpperCase()] ?? null,
          partLabel: piped[3]
            ? piped[3].trim()
            : `Part ${piped[2].toUpperCase()}`,
          lineRef: piped[4],
          line: Number(piped[4]),
          label: piped[5].trim(),
          amount,
        });
        continue;
      }

      const filer = FILER_LINE.exec(line);
      if (filer) {
        filerName = filer[1].trim();
        continue;
      }

      if (FORM_HEADER.test(line)) {
        form = form ?? normalizeForm(line, text);
        const year = /(19|20)\d{2}/.exec(line);
        if (year) {
          taxYear = Number(year[0]);
        }
        continue;
      }

      const numbered = NUMBERED_LINE.exec(line);
      if (!numbered) {
        continue;
      }

      const lineRef = numbered[1];
      const rest = numbered[2].trim();
      if (!rest) {
        unparsedLines.push({ lineRef, text: squeeze(line) });
        continue;
      }

      const amountMatch = TRAILING_AMOUNT.exec(rest);
      if (!amountMatch) {
        unparsedLines.push({ lineRef, text: squeeze(line) });
        continue;
      }

      const amount = parseAmount(amountMatch[1]);
      const label = rest.slice(0, amountMatch.index).trim();
      if (amount === null || !label) {
        unparsedLines.push({ lineRef, text: squeeze(line) });
        continue;
      }

      lineItems.push({
        partNumber,
        partLabel,
        lineRef,
        line: parseInt(lineRef, 10),
        label,
        amount,
      });
    }
  }

  let grossIncome: number | null = null;
  let totalExpenses: number | null = null;
  let netProfit: number | null = null;

  for (const item of lineItems) {
    if (grossIncome === null && GROSS_INCOME.test(item.label)) {
      grossIncome = item.amount;
      continue;
    }
    if (totalExpenses === null && TOTAL_EXPENSES.test(item.label)) {
      totalExpenses = item.amount;
      continue;
    }
    if (netProfit === null && NET_RESULT.test(item.label)) {
      netProfit = item.amount;
    }
  }

  const computedNetProfit =
    grossIncome !== null && totalExpenses !== null
      ? (toCents(grossIncome) - toCents(totalExpenses)) / 100
      : null;
  const difference =
    computedNetProfit !== null && netProfit !== null
      ? (toCents(netProfit) - toCents(computedNetProfit)) / 100
      : null;
  const consistent = difference === null ? null : difference === 0;

  return {
    documentId: '',
    form,
    taxYear,
    filerName,
    lineItems,
    unparsedLines,
    reportedTotals: { grossIncome, totalExpenses, netProfit },
    reconciliation: {
      consistent,
      reportedNetProfit: netProfit,
      computedNetProfit,
      difference,
    },
  };
};

function normalizeForm(candidate: string, whole: string): string {
  const match = FORM_HEADER.exec(candidate) ?? FORM_HEADER.exec(whole);
  if (!match) {
    return candidate.trim();
  }
  if (match[2]) {
    return `Schedule ${match[2].toUpperCase()}`;
  }
  return 'Form 1040';
}
