import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production email verification wiring', () => {
  it('keeps automatic email verification disabled in Kubernetes', () => {
    const manifest = readFileSync(
      resolve(__dirname, '../../../k8s/base/services/authentication.yaml'),
      'utf8'
    );

    expect(manifest).toContain(
      "- name: AUTH_AUTO_VERIFY_EMAILS\n              value: 'false'"
    );
  });
});
