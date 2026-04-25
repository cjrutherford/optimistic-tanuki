import * as yaml from 'js-yaml';

declare const __dirname: string;
declare const require: (id: string) => any;

const fs = require('fs');
const path = require('path');

describe('wellness config', () => {
  it('uses the bootstrap database name expected by db setup', () => {
    const configPath = path.resolve(__dirname, '../assets/config.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as {
      database: { database: string };
    };

    expect(config.database.database).toBe('ot_wellness');
  });
});
