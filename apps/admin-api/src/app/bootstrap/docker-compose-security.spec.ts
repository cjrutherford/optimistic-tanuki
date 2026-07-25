import * as fs from 'fs';
import * as path from 'path';

describe('admin-api production compose exposure', () => {
  it('binds the admin API port to loopback only', () => {
    const compose = fs.readFileSync(
      path.join(process.cwd(), 'docker-compose.yaml'),
      'utf-8'
    );

    expect(compose).toContain("- '127.0.0.1:${ADMIN_API_PORT:-8098}:8098'");
  });
});
