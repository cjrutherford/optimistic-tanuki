import {
  FinCommanderImportPreview,
  FinCommanderImportProvider,
} from './fin-commander-import-registry.service';

function normalizeType(value: string): 'credit' | 'debit' {
  return value.trim().toLowerCase() === 'credit' ? 'credit' : 'debit';
}

/**
 * Parse a raw amount string (dollars) into integer cents. Guards against NaN
 * so malformed rows import as 0 rather than corrupting the money path.
 */
export function parseAmountToCents(value: string | undefined): number {
  const parsed = parseFloat((value ?? '').trim());
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export const csvImportProvider: FinCommanderImportProvider = {
  manifest: {
    id: 'csv',
    name: 'CSV Intake',
    description:
      'Paste exported transaction rows from a bank or card statement.',
    inputLabel: 'CSV rows',
    placeholder: 'date,description,amount,type,category',
  },
  async preview(input: string): Promise<FinCommanderImportPreview> {
    const rows = input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const transactions = rows.slice(1).map((row, index) => {
      const [postedOn, description, amount, type, category] = row.split(',');

      return {
        postedOn: postedOn?.trim() || new Date().toISOString().slice(0, 10),
        description: description?.trim() || `Imported row ${index + 1}`,
        amountCents: parseAmountToCents(amount),
        type: normalizeType(type ?? 'debit'),
        category: category?.trim() || 'Imported',
        payeeOrVendor: description?.trim() || 'Unknown merchant',
      };
    });

    return {
      providerId: 'csv',
      title: 'CSV preview',
      warnings:
        rows.length <= 1
          ? ['No transaction rows detected beyond the header.']
          : [],
      transactions,
    };
  },
};
