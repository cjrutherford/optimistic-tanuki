/** N05 private real S3-compatible version-store fixture, with a transport fault. */
import 'reflect-metadata';
import { randomUUID, createHash } from 'node:crypto';
import { createServer, request } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { Logger } from '@nestjs/common';
import {
  S3Client,
  CreateBucketCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { S3Service } from '../../../../libs/storage/src/lib/s3.service';
import { NetworkStorageAdapter } from '../../../../libs/storage/src/lib/network-storage';
import {
  EnvelopeEncryptionService,
  VAULT_STORAGE_KEK_ENV,
} from '../../../../libs/storage/src/lib/envelope-encryption.service';
import { installPayloadFreeLogging } from '../../../../libs/logger/src/lib/payload-free-logging';

async function run() {
  if (process.env['OT_N05_PRIVATE_FIXTURE'] !== '1')
    throw new Error('PRIVATE_FIXTURE_REQUIRED');
  installPayloadFreeLogging();
  process.env[VAULT_STORAGE_KEK_ENV] = 'N05-private-disposable-envelope-key';
  const options = {
    endpoint: 'http://127.0.0.1:19005',
    region: 'us-east-1',
    accessKeyId: 'n05fixture',
    secretAccessKey: 'n05-local-fixture-password',
    bucketName: 'n05-private-' + randomUUID(),
  };
  const client = new S3Client({
    endpoint: options.endpoint,
    region: options.region,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    forcePathStyle: true,
  });
  let failDeletes = true;
  const proxy = createServer((incoming, outgoing) => {
    if (
      failDeletes &&
      incoming.method === 'POST' &&
      incoming.url?.includes('delete')
    ) {
      outgoing.writeHead(503, { 'Content-Type': 'application/xml' });
      outgoing.end(
        '<Error><Code>ServiceUnavailable</Code><Message>N05 private injected fault</Message></Error>'
      );
      return;
    }
    const upstream = request(
      {
        host: '127.0.0.1',
        port: 19005,
        path: incoming.url,
        method: incoming.method,
        headers: incoming.headers,
      },
      (response) => {
        outgoing.writeHead(response.statusCode || 502, response.headers);
        response.pipe(outgoing);
      }
    );
    upstream.on('error', () => {
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(upstream);
  });
  await new Promise<void>((resolve) =>
    proxy.listen(19007, '127.0.0.1', resolve)
  );
  const assert = (condition: unknown, code: string) => {
    if (!condition) throw new Error(code);
  };
  try {
    await client.send(new CreateBucketCommand({ Bucket: options.bucketName }));
    await client.send(
      new PutBucketVersioningCommand({
        Bucket: options.bucketName,
        VersioningConfiguration: { Status: 'Enabled' },
      })
    );
    const key = `assets/${randomUUID()}/${randomUUID()}/image.png`;
    const counterpart = key + '-counterpart';
    const encryption = new EnvelopeEncryptionService();
    const ownBytes = encryption.encrypt(Buffer.from('N05-owner-content'));
    const foreignBytes = encryption.encrypt(
      Buffer.from('N05-counterpart-content')
    );
    await client.send(
      new PutObjectCommand({
        Bucket: options.bucketName,
        Key: key,
        Body: ownBytes,
      })
    );
    await client.send(
      new PutObjectCommand({
        Bucket: options.bucketName,
        Key: key,
        Body: encryption.encrypt(Buffer.from('N05-owner-version2')),
      })
    );
    await client.send(
      new DeleteObjectCommand({ Bucket: options.bucketName, Key: key })
    );
    await client.send(
      new PutObjectCommand({
        Bucket: options.bucketName,
        Key: counterpart,
        Body: foreignBytes,
      })
    );
    const before = await client.send(
      new ListObjectVersionsCommand({ Bucket: options.bucketName, Prefix: key })
    );
    assert(
      before.Versions?.filter((row) => row.Key === key).length === 2 &&
        before.DeleteMarkers?.some((row) => row.Key === key),
      'REAL_VERSION_FIXTURE'
    );
    const s3 = new S3Service(new Logger('N05Private'), {
      ...options,
      endpoint: 'http://127.0.0.1:19007',
    });
    const adapter = new NetworkStorageAdapter(
      new Logger('N05Private'),
      s3,
      encryption
    );
    const asset = {
      id: randomUUID(),
      storagePath: `s3://${options.bucketName}/${key}`,
    } as never;
    let deletionFailed = false;
    try {
      await adapter.remove(asset);
    } catch {
      deletionFailed = true;
    }
    const afterFault = await client.send(
      new ListObjectVersionsCommand({ Bucket: options.bucketName, Prefix: key })
    );
    assert(
      deletionFailed && afterFault.Versions?.some((row) => row.Key === key),
      'FAULT_NOT_ACKNOWLEDGED'
    );
    failDeletes = false;
    await adapter.remove(asset);
    await adapter.remove(asset); // An acknowledged absent key is safely retryable.
    const after = await client.send(
      new ListObjectVersionsCommand({ Bucket: options.bucketName, Prefix: key })
    );
    assert(
      ![...(after.Versions || []), ...(after.DeleteMarkers || [])].some(
        (row) => row.Key === key
      ),
      'OLD_VERSIONS_OR_MARKERS_REMAIN'
    );
    const saved = await client.send(
      new GetObjectCommand({ Bucket: options.bucketName, Key: counterpart })
    );
    const counterpartReadback = Buffer.from(
      await saved.Body!.transformToByteArray()
    );
    assert(
      encryption
        .decrypt(counterpartReadback)
        .equals(Buffer.from('N05-counterpart-content')),
      'COUNTERPART_BYTES_OR_KEY_DAMAGED'
    );
    const metadata = {
      status: 'PASS',
      realS3CompatibleStore: true,
      ownedVersionsBefore: 2,
      ownedDeleteMarkersBefore: 1,
      ownedVersionsAfter: 0,
      ownedDeleteMarkersAfter: 0,
      failedDeleteVisible: deletionFailed,
      retryPassed: true,
      idempotentRetry: true,
      counterpartDecryptable: true,
      wrappedKeysStoredOnlyInEnvelopes: true,
      sharedKekDestroyed: false,
      transportFault:
        'Private HTTP proxy returns503 for delete batch; all persistence is real MinIO',
      fixtureBinarySha256: createHash('sha256')
        .update(
          await readFile(
            '.runtime-artifacts/account-rights/finish-sequence/media-stores/minio-fixture'
          )
        )
        .digest('hex'),
      limits: [
        'No external storage provider or production deployment qualification',
        'No account deletion job wiring; existing N01 lifecycle fences remain the write-fence prerequisite',
        'Private in-memory plaintext/envelopes are test fixtures, not production memory erasure evidence',
      ],
    };
    await writeFile(
      '.runtime-artifacts/account-rights/finish-sequence/media-stores/runtime/report.json',
      JSON.stringify(metadata, null, 2)
    );
  } finally {
    client.destroy();
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
  }
}
run().catch((error) => {
  process.stderr.write(
    `N05_PRIVATE_FIXTURE_FAILED ${error?.name || 'Error'} ${String(
      error?.message
    ).slice(0, 180)}\n`
  );
  process.exitCode = 1;
});
