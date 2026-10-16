import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import AuthCommands from '../../libs/constants/src/lib/libs/authentication';
import { firstValueFrom, timeout } from 'rxjs';

const [operation, policyVersion] = process.argv.slice(2);
const commands = {
  schedule: AuthCommands.ScheduleGuardianPolicyNotice,
  status: AuthCommands.GetGuardianPolicyNoticeStatus,
  retry: AuthCommands.RetryGuardianPolicyNoticeFailures,
} as const;

async function main(): Promise<void> {
  if (
    !operation ||
    !Object.prototype.hasOwnProperty.call(commands, operation) ||
    !policyVersion
  ) {
    throw new Error(
      'Usage: guardian-policy-notice <schedule|status|retry> <approved-policy-version>'
    );
  }
  const host = process.env.AUTH_SERVICE_HOST || '127.0.0.1';
  const port = Number(process.env.AUTH_SERVICE_PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('AUTH_SERVICE_PORT must be a valid TCP port');
  }
  const operatorToken = process.env.GUARDIAN_POLICY_NOTICE_OPERATOR_TOKEN;
  if (!operatorToken) {
    throw new Error('GUARDIAN_POLICY_NOTICE_OPERATOR_TOKEN is required');
  }
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host, port },
  });
  try {
    await client.connect();
    const result = await firstValueFrom(
      client
        .send(
          { cmd: commands[operation as keyof typeof commands] },
          { policyVersion, operatorToken }
        )
        .pipe(timeout(30_000))
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await client.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown failure';
  process.stderr.write(`Guardian policy notice operation failed: ${message}\n`);
  process.exitCode = 1;
});
