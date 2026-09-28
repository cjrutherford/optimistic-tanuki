import { gunzipSync } from 'node:zlib';
import { ClientDeploymentArtifacts } from '@optimistic-tanuki/models';
import { createClientDeploymentArchive } from './client-deployment-archive';

describe('createClientDeploymentArchive', () => {
  it('creates an extractable tar.gz with every named artifact and private env mode', () => {
    const files: ClientDeploymentArtifacts = {
      'docker-compose.client.yml':
        'services:\n  gateway:\n    image: example/gateway:tag\n',
      '.env': 'JWT_SECRET=private-value\n',
      'gateway-config.yaml': 'services: []\n',
      'gateway-composition.yaml': 'services: []\n',
      'bootstrap-owner.mjs': 'console.log("owner bootstrap")\n',
      'proposal.md': '# Proposal\n',
    };

    const archive = createClientDeploymentArchive(files);
    const tar = gunzipSync(archive);
    const extracted = extractTarEntries(tar);

    expect([...extracted.keys()]).toEqual([
      'docker-compose.client.yml',
      '.env',
      'gateway-config.yaml',
      'gateway-composition.yaml',
      'bootstrap-owner.mjs',
      'proposal.md',
    ]);
    expect(extracted.get('docker-compose.client.yml')?.content).toBe(
      files['docker-compose.client.yml']
    );
    expect(extracted.get('.env')?.content).toBe(files['.env']);
    expect(extracted.get('.env')?.mode).toBe(0o600);
    expect(extracted.get('proposal.md')?.mode).toBe(0o644);
  });
});

function extractTarEntries(
  tar: Buffer
): Map<string, { content: string; mode: number }> {
  const files = new Map<string, { content: string; mode: number }>();
  let offset = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const path = readNullTerminatedText(header, 0, 100);
    const mode = Number.parseInt(readNullTerminatedText(header, 100, 8), 8);
    const size = Number.parseInt(readNullTerminatedText(header, 124, 12), 8);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    files.set(path, {
      content: tar.subarray(contentStart, contentEnd).toString('utf8'),
      mode,
    });
    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  return files;
}

function readNullTerminatedText(
  buffer: Buffer,
  offset: number,
  width: number
): string {
  const field = buffer.subarray(offset, offset + width);
  const terminator = field.indexOf(0);
  return field
    .subarray(0, terminator < 0 ? field.length : terminator)
    .toString('ascii')
    .trim();
}
