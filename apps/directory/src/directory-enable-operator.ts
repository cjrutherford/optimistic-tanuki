/** Operator process only; never expose its key material to services or workers. */
import 'reflect-metadata';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import db from './data-source';
import { enableDirectory } from './directory-enabled';
import {
  signOperatorAttestation,
  OperatorAttestation,
} from '../../../libs/social/contracts/src/lib/directory-operator-attestation';

async function main() {
  const [
    confirmation,
    sourceEpoch,
    recoveryEpoch,
    owner,
    activationId,
    socialGeneration,
    directoryGeneration,
    ...extra
  ] = process.argv.slice(2);
  if (
    confirmation !== '--confirm-external-fence' ||
    extra.length ||
    !sourceEpoch ||
    !recoveryEpoch ||
    !owner ||
    !activationId ||
    !socialGeneration ||
    !directoryGeneration ||
    !process.env.SOCIAL_DATABASE_URL ||
    !process.env.DIRECTORY_DATABASE_URL
  )
    throw Error('Invalid operator preconditions');
  const read = (name: string) => {
    const path = process.env[name];
    if (!path) throw Error('Missing operator key');
    return readFileSync(path);
  };
  const privateKey = createPrivateKey(
    read('DIRECTORY_OPERATOR_PRIVATE_KEY_FILE')
  );
  const config = {
    socialPublicKey: createPublicKey(read('SOCIAL_OPERATOR_PUBLIC_KEY_FILE')),
    directoryPublicKey: createPublicKey(
      read('DIRECTORY_OPERATOR_PUBLIC_KEY_FILE')
    ),
    socialKeyId: process.env.SOCIAL_OPERATOR_KEY_ID || '',
    directoryKeyId: process.env.DIRECTORY_OPERATOR_KEY_ID || '',
  };
  const der = (key: ReturnType<typeof createPublicKey>) =>
    key.export({ type: 'spki', format: 'der' });
  if (
    privateKey.asymmetricKeyType !== 'ed25519' ||
    config.socialPublicKey.asymmetricKeyType !== 'ed25519' ||
    config.directoryPublicKey.asymmetricKeyType !== 'ed25519' ||
    !der(createPublicKey(privateKey)).equals(der(config.directoryPublicKey)) ||
    der(config.socialPublicKey).equals(der(config.directoryPublicKey)) ||
    !/^[A-Za-z0-9._-]{1,128}$/.test(config.socialKeyId) ||
    !/^[A-Za-z0-9._-]{1,128}$/.test(config.directoryKeyId) ||
    config.socialKeyId === config.directoryKeyId
  )
    throw Error('Invalid operator keys');
  const input = readFileSync(0, 'utf8');
  if (Buffer.byteLength(input) > 16384) throw Error('Invalid proof');
  const proof: OperatorAttestation = JSON.parse(input);
  const identity = {
    sourceEpoch,
    recoveryEpoch,
    owner,
    activationId,
    socialGeneration,
    directoryGeneration,
  };
  const social = new DataSource({
    type: 'postgres',
    url: process.env.SOCIAL_DATABASE_URL,
    extra: { connectionTimeoutMillis: 2000, statement_timeout: 10000 },
  });
  await social.initialize();
  try {
    await db.initialize();
    try {
      const result = await enableDirectory(
        social,
        db,
        identity,
        proof,
        config,
        true
      );
      const attestation = signOperatorAttestation(
        'directory-enabled',
        identity,
        { version: 'social-prepared-v1', digest: result.preparedDigest },
        privateKey,
        config
      );
      process.stdout.write(JSON.stringify({ result, attestation }) + '\n');
    } finally {
      await db.destroy();
    }
  } finally {
    await social.destroy();
  }
}
main().catch(() => {
  process.stderr.write(
    'Directory enable failed; check operator preconditions and authority.\n'
  );
  process.exitCode = 1;
});
