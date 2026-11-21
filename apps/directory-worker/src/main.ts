import { assertRestoreProtocolAvailable } from '../../directory/src/restore-fence';
import { createServer } from 'node:http';
import { DirectoryQueue } from './queue';
import { runWorker } from './worker';
import { SocialDelivery, requireAcknowledgedReceipt } from './social-delivery';
import { DeliveryScan } from './onboarding';

async function main(): Promise<void> {
  if (process.env.DIRECTORY_WORKER_MODE === 'register-pending-v1') {
    const { registerWorkerConfig, runRegisterWorker } = await import(
      './register-runtime'
    );
    await runRegisterWorker(registerWorkerConfig(process.env));
    return;
  }
  assertRestoreProtocolAvailable();
  const {
    DIRECTORY_REDIS_URL: url,
    DIRECTORY_QUEUE_PREFIX: prefix,
    DIRECTORY_SERVICE_SECRET: secret,
    DIRECTORY_RECEIPT_URL: endpoint,
    SOCIAL_HOST: host,
  } = process.env;
  if (
    !url ||
    !prefix ||
    !host ||
    !endpoint ||
    !secret ||
    Buffer.byteLength(secret) < 32
  )
    throw new Error('Worker configuration missing');
  const queue = await DirectoryQueue.connect(url, prefix, {
    maxJobs:
      process.env.DIRECTORY_QUEUE_MAX_JOBS === undefined
        ? undefined
        : Number(process.env.DIRECTORY_QUEUE_MAX_JOBS),
    retentionMs:
      process.env.DIRECTORY_QUEUE_RETENTION_MS === undefined
        ? undefined
        : Number(process.env.DIRECTORY_QUEUE_RETENTION_MS),
  });
  const social = new SocialDelivery(
    host,
    Number(process.env.SOCIAL_PORT || 3003),
    process.env.DIRECTORY_SOCIAL_SECRET || ''
  );
  createServer(async (req, res) => {
    if (req.url !== '/health/ready') {
      res.writeHead(404).end();
      return;
    }
    try {
      const ready = await queue.ready();
      res.writeHead(ready ? 200 : 503).end();
    } catch {
      res.writeHead(503).end();
    }
  }).listen(Number(process.env.DIRECTORY_WORKER_PORT || 3121), '0.0.0.0');
  const controller = new AbortController();
  const scan = new DeliveryScan();
  const delivery = async () => {
    while (!controller.signal.aborted) {
      try {
        await scan.deliverBatch(social, {
          apply: async ({ revision, communityId, eventNonce, sourceEpoch }) => {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                authorization: `Bearer ${secret}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                revision,
                communityId,
                eventNonce,
                sourceEpoch,
              }),
              signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) throw new Error('Directory unavailable');
            const receipt = (await response.json()) as {
              revision: string;
              communityId: string;
              eventNonce: string;
              sourceEpoch: string;
              recoveryEpoch: string;
              status?: string;
              attestation?: string;
            };
            if (
              receipt.revision !== revision ||
              receipt.communityId !== communityId ||
              receipt.eventNonce !== eventNonce ||
              receipt.sourceEpoch !== sourceEpoch ||
              !/^[0-9a-f-]{36}$/.test(receipt.recoveryEpoch)
            )
              throw new Error('Invalid receipt');
            if (
              receipt.status === 'retired' &&
              receipt.attestation === undefined
            )
              return;
            if (
              typeof receipt.attestation !== 'string' ||
              !/^[0-9a-f]{64}$/.test(receipt.attestation)
            )
              throw new Error('Invalid receipt');
            const ack = await social.acknowledge(receipt, receipt.attestation);
            requireAcknowledgedReceipt(ack);
          },
        });
      } catch {
        console.error('Directory Social delivery failed; retrying');
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 5000));
    }
  };
  try {
    await Promise.all([runWorker(queue, controller.signal), delivery()]);
  } finally {
    social.close();
    await queue.close();
  }
}
main().catch(() => {
  console.error('Directory worker failed to start');
  process.exit(1);
});
