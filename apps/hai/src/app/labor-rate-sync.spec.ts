import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LABOR_RATE_PER_HOUR } from './content/pricing';

/**
 * The website, the quote engine, and the Appliance Portal each state the
 * published labor rate (D019). Browser apps cannot share the API's constant,
 * so this keeps the three copies equal.
 */
describe('published labor rate', () => {
  const root = join(__dirname, '../../../..');
  const declared = (file: string, name: string): number => {
    const source = readFileSync(join(root, file), 'utf8');
    const match = source.match(
      new RegExp(`export const ${name} = (\\d+(?:\\.\\d+)?);`)
    );
    if (!match) throw new Error(`${name} not found in ${file}`);
    return Number(match[1]);
  };

  it.each([
    [
      'apps/system-configurator-api/src/hardware/commercial-pricing.ts',
      'HAI_LABOR_RATE_PER_HOUR',
    ],
    [
      'apps/system-configurator/src/app/services/hardware.service.ts',
      'HAI_LABOR_RATE_PER_HOUR',
    ],
  ])('matches %s', (file, name) => {
    expect(declared(file, name)).toBe(LABOR_RATE_PER_HOUR);
  });
});
