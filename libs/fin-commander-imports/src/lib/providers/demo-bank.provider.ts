import { FinCommanderImportProvider } from './fin-commander-import-registry.service';

export const demoBankImportProvider: FinCommanderImportProvider = {
  manifest: {
    id: 'demo-bank',
    name: 'Demo Bank Feed',
    description: 'Load a mock bank feed to validate the preview-and-commit workflow.',
    inputLabel: 'Optional note',
    placeholder: 'No raw input required for the demo bank feed.',
    inputOptional: true,
  },
  async preview(input: string) {
    return {
      providerId: 'demo-bank',
      title: input?.trim() ? `Demo feed: ${input.trim()}` : 'Demo bank feed preview',
      warnings: ['Demo feed transactions are synthetic and intended for workflow validation only.'],
      transactions: [
        {
          postedOn: '2026-04-09',
          amount: 128.42,
          type: 'debit' as const,
          category: 'Groceries',
          description: 'River Market',
          payeeOrVendor: 'River Market',
        },
        {
          postedOn: '2026-04-10',
          amount: 2400,
          type: 'credit' as const,
          category: 'Income',
          description: 'Client retainer',
          payeeOrVendor: 'Northwind Studio',
        },
      ],
    };
  },
};
