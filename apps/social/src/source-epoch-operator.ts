import { initializeDirectoryRegister } from './app/services/community-directory-register-initialize';
/** Internal operator entrypoint; never wired to an HTTP or messaging endpoint. */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { activateSocial } from './app/services/social-final-activation';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { signOperatorAttestation } from '../../../libs/social/contracts/src/lib/directory-operator-attestation';
import db from './app/staticDatabase';
import { beginRecovery, enableRegisterCapture, bindSocialAuthority, prepareSocialAuthority, fenceSourceEpoch, initializeSourceEpoch, rotateSourceEpoch } from './app/services/community-directory-epoch';

async function main(): Promise<void> {
  const [action, confirmation, ...extra] = process.argv.slice(2);
  if (action === 'enable-register-capture') {
    if (confirmation !== '--confirm-external-fence' || extra.length) throw new Error('External fence confirmation required');
    await db.initialize();
    try { await enableRegisterCapture(db, true); } finally { await db.destroy(); }
    process.stdout.write('Social register capture enabled.\n');
    return;
  }
  if (action === 'initialize-register') {
    if (confirmation !== '--confirm-external-fence' || extra.length) throw new Error('External fence confirmation required');
    await db.initialize();
    try {
      await initializeDirectoryRegister(db, true);
      process.stdout.write('Social directory register initialized; external fence remains required.\n');
    } finally { await db.destroy(); }
    return;
  }
  if (action === 'activate-final') {
    if (confirmation !== '--confirm-external-fence' || extra.length !== 6 || !process.env.SOCIAL_DATABASE_URL || !process.env.DIRECTORY_DATABASE_URL) throw new Error('Invalid operator preconditions');
    let input = '';
    for await (const chunk of process.stdin) { input += chunk; if (Buffer.byteLength(input) > 16384) throw new Error('Proof too large'); }
    const proofs = JSON.parse(input);
    if (!proofs || Object.keys(proofs).sort().join(',') !== 'enabled,prepared') throw new Error('Invalid proof bundle');
    const keys = { socialPublicKey: readFileSync(process.env.SOCIAL_OPERATOR_PUBLIC_KEY_FILE || '', 'utf8'), directoryPublicKey: readFileSync(process.env.DIRECTORY_OPERATOR_PUBLIC_KEY_FILE || '', 'utf8'), socialKeyId: process.env.SOCIAL_OPERATOR_KEY_ID || '', directoryKeyId: process.env.DIRECTORY_OPERATOR_KEY_ID || '' };
    const identity = { sourceEpoch: extra[0], recoveryEpoch: extra[1], owner: extra[2], activationId: extra[3], socialGeneration: extra[4], directoryGeneration: extra[5] };
    const options = { connectionTimeoutMillis: 2000, statement_timeout: 10000 };
    const social = new DataSource({type:'postgres', url:process.env.SOCIAL_DATABASE_URL, extra:options});
    const directory = new DataSource({type:'postgres', url:process.env.DIRECTORY_DATABASE_URL, extra:options});
    try {
      await directory.initialize(); await social.initialize();
      const result = await activateSocial(social, directory, identity, proofs.prepared, proofs.enabled, keys, true);
      process.stdout.write(JSON.stringify({result}) + '\n');
    } finally { if (social.isInitialized) await social.destroy(); if (directory.isInitialized) await directory.destroy(); }
    return;
  }
  if (action === 'activate') throw new Error('Legacy Social activation is disabled until the authority transition is implemented');
  if (action === 'bind' || action === 'prepare') {
    if (confirmation !== '--confirm-external-fence' || extra.length !== 6) throw new Error('Usage: source-epoch-operator <bind|prepare> --confirm-external-fence <sourceEpoch> <recoveryEpoch> <owner> <activationId> <socialGeneration> <directoryGeneration> (proof JSON on stdin)');
    let input = '';
    for await (const chunk of process.stdin) { input += chunk; if (input.length > 4096) throw new Error('Proof too large'); }
    const proof = JSON.parse(input);
    const identity = { sourceEpoch: extra[0], recoveryEpoch: extra[1], owner: extra[2], activationId: extra[3], socialGeneration: extra[4], directoryGeneration: extra[5] };
    let signing: { privateKey: ReturnType<typeof createPrivateKey>; config: { socialPublicKey: string; directoryPublicKey: string; socialKeyId: string; directoryKeyId: string } } | undefined;
    if (action === 'prepare') {
      // Read only in this operator process; never forward key material to a worker.
      const privateKey = createPrivateKey(readFileSync(process.env.SOCIAL_OPERATOR_PRIVATE_KEY_FILE || ''));
      const config = { socialPublicKey: readFileSync(process.env.SOCIAL_OPERATOR_PUBLIC_KEY_FILE || '', 'utf8'), directoryPublicKey: readFileSync(process.env.DIRECTORY_OPERATOR_PUBLIC_KEY_FILE || '', 'utf8'), socialKeyId: process.env.SOCIAL_OPERATOR_KEY_ID || '', directoryKeyId: process.env.DIRECTORY_OPERATOR_KEY_ID || '' };
      const social = createPublicKey(config.socialPublicKey), directory = createPublicKey(config.directoryPublicKey);
      const der = (key: ReturnType<typeof createPublicKey>) => key.export({ type: 'spki', format: 'der' });
      if (privateKey.asymmetricKeyType !== 'ed25519' || social.asymmetricKeyType !== 'ed25519' || directory.asymmetricKeyType !== 'ed25519' || !der(createPublicKey(privateKey)).equals(der(social)) || der(social).equals(der(directory)) || !/^[A-Za-z0-9._-]{1,128}$/.test(config.socialKeyId) || !/^[A-Za-z0-9._-]{1,128}$/.test(config.directoryKeyId) || config.socialKeyId === config.directoryKeyId) throw new Error('Invalid or reused operator key');
      signing = { privateKey, config };
    }
    await db.initialize();
    try {
      if (action === 'bind') {
        await bindSocialAuthority(db, identity, proof, process.env.DIRECTORY_RECOVERY_PROOF_SECRET || '');
        process.stdout.write('Social authority bind completed; Social remains fenced.\n');
      } else {
        const prepared = await prepareSocialAuthority(db, identity, proof, process.env.DIRECTORY_RECOVERY_PROOF_SECRET || '');
        const attestation = signOperatorAttestation('social-prepared', identity, { version: prepared.version, digest: prepared.digest }, signing!.privateKey, signing!.config);
        process.stdout.write(JSON.stringify({ prepared, attestation }) + '\n');
      }
    } finally { await db.destroy(); }
    return;
  }
  if (extra.length || confirmation !== '--confirm-external-fence' || !['initialize', 'fence', 'rotate', 'begin-recovery'].includes(action)) {
    throw new Error('Usage: source-epoch-operator <initialize|fence|rotate|begin-recovery> --confirm-external-fence');
  }
  await db.initialize();
  try {
    await ({ initialize: initializeSourceEpoch, fence: fenceSourceEpoch, rotate: rotateSourceEpoch, 'begin-recovery': beginRecovery }[action] as typeof fenceSourceEpoch)(db);
    process.stdout.write(`Source epoch ${action} completed.\n`);
  } finally {
    await db.destroy();
  }
}
main().catch(() => { process.stderr.write('Social operator failed; authority remains subject to the external fence.\n'); process.exitCode = 1; });
