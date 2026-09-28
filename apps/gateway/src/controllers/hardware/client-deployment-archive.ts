import { gzipSync } from 'node:zlib';
import type { ClientDeploymentArtifacts } from '@optimistic-tanuki/models';

const BLOCK_SIZE = 512;
const ARCHIVE_FILES: Array<keyof ClientDeploymentArtifacts> = [
  'docker-compose.client.yml',
  '.env',
  'gateway-config.yaml',
  'gateway-composition.yaml',
  'bootstrap-owner.mjs',
  'proposal.md',
];

/** Build a deterministic tar.gz containing only the declared client artifacts. */
export function createClientDeploymentArchive(
  files: ClientDeploymentArtifacts
): Buffer {
  const blocks: Buffer[] = [];

  for (const path of ARCHIVE_FILES) {
    const content = Buffer.from(files[path], 'utf8');
    const header = createTarHeader(
      path,
      content.length,
      path === '.env' ? 0o600 : 0o644
    );
    blocks.push(header, content);
    const padding = (BLOCK_SIZE - (content.length % BLOCK_SIZE)) % BLOCK_SIZE;
    if (padding > 0) blocks.push(Buffer.alloc(padding));
  }

  blocks.push(Buffer.alloc(BLOCK_SIZE * 2));
  return gzipSync(Buffer.concat(blocks));
}

function createTarHeader(path: string, size: number, mode: number): Buffer {
  const header = Buffer.alloc(BLOCK_SIZE);
  writeText(header, path, 0, 100);
  writeOctal(header, mode, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, size, 124, 12);
  writeOctal(header, 0, 136, 12);
  header.fill(0x20, 148, 156);
  writeText(header, '0', 156, 1);
  writeText(header, 'ustar\0', 257, 6);
  writeText(header, '00', 263, 2);

  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeText(header, checksum.toString(8).padStart(6, '0'), 148, 6);
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function writeText(
  target: Buffer,
  value: string,
  offset: number,
  width: number
): void {
  const encoded = Buffer.from(value, 'utf8');
  if (encoded.length > width) {
    throw new Error(`Tar header value exceeds its ${width}-byte field.`);
  }
  encoded.copy(target, offset);
}

function writeOctal(
  target: Buffer,
  value: number,
  offset: number,
  width: number
): void {
  const encoded = value.toString(8).padStart(width - 1, '0');
  if (encoded.length > width - 1) {
    throw new Error('Tar numeric field exceeds its supported range.');
  }
  target.write(encoded, offset, width - 1, 'ascii');
  target[offset + width - 1] = 0;
}
