import { readFileSync } from 'fs';
import { join } from 'path';

describe('seed-store', () => {
  it('includes seeded artist inventory products for the independent artist scenario', () => {
    const seedSource = readFileSync(join(__dirname, 'seed-store.ts'), 'utf8');

    expect(seedSource).toContain('Emberline Studio Mini Print Set');
    expect(seedSource).toContain('Emberline Studio Sticker Sheet');
    expect(seedSource).toContain('Original Gouache Landscape');
  });
});
