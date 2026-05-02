import fs from 'fs';
import path from 'path';

describe('blogging migrations', () => {
  it('uses unique migration class names', () => {
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const classNames = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
      .map((source) => source.match(/export class\s+(\w+)/)?.[1])
      .filter((name): name is string => Boolean(name));

    expect(new Set(classNames).size).toBe(classNames.length);
  });
});
