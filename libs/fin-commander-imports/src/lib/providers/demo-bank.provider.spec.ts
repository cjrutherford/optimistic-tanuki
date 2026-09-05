import { demoBankImportProvider } from './demo-bank.provider';

describe('demoBankImportProvider', () => {
  it('exposes a manifest describing the provider', () => {
    expect(demoBankImportProvider.manifest).toEqual({
      id: 'demo-bank',
      name: 'Demo Bank Feed',
      description:
        'Load a mock bank feed to validate the preview-and-commit workflow.',
      inputLabel: 'Optional note',
      placeholder: 'No raw input required for the demo bank feed.',
      inputOptional: true,
    });
  });

  describe('preview', () => {
    it('uses a generic title when no input is given', async () => {
      const preview = await demoBankImportProvider.preview('');
      expect(preview.providerId).toBe('demo-bank');
      expect(preview.title).toBe('Demo bank feed preview');
      expect(preview.warnings).toHaveLength(1);
      expect(preview.transactions).toHaveLength(2);
    });

    it('uses a generic title when input is only whitespace', async () => {
      const preview = await demoBankImportProvider.preview('   ');
      expect(preview.title).toBe('Demo bank feed preview');
    });

    it('includes the trimmed note in the title when provided', async () => {
      const preview = await demoBankImportProvider.preview('  my note  ');
      expect(preview.title).toBe('Demo feed: my note');
    });

    it('returns synthetic transactions with integer cent amounts', async () => {
      const preview = await demoBankImportProvider.preview('');
      expect(preview.transactions[0]).toMatchObject({
        amountCents: 12842,
        type: 'debit',
        category: 'Groceries',
      });
      expect(preview.transactions[1]).toMatchObject({
        amountCents: 240000,
        type: 'credit',
        category: 'Income',
      });
    });
  });
});
