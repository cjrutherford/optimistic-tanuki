import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Payload-free logging in an isolated HTTP process', () => {
  it('contains console and Nest payloads during real bootstrap and an HTTP request', () => {
    const source = resolve('libs/logger/src/lib/payload-free-logging.ts');
    const script = `
      require('reflect-metadata');
      const { installPayloadFreeLogging } = require(${JSON.stringify(source)});
      const { NestFactory } = require('@nestjs/core');
      const { Module, Controller, Get, Logger } = require('@nestjs/common');
      const secret = 'N04_PRIVATE_HTTP_SENTINEL';
      class Probe {
        run() {
          console.log(secret, {userId: secret}, new Error(secret));
          console.trace(secret);
          console.table([{email: secret}]);
          new Logger(secret).error(secret, secret);
          new Logger(secret).log({event: 'profile.operation', outcome: 'ok', body: secret});
          return {ok: true};
        }
      }
      Get('/')(Probe.prototype, 'run', Object.getOwnPropertyDescriptor(Probe.prototype, 'run'));
      Controller()(Probe);
      class TestModule {}
      Module({controllers: [Probe]})(TestModule);
      (async () => {
        installPayloadFreeLogging();
        installPayloadFreeLogging();
        const app = await NestFactory.create(TestModule);
        try {
          await app.listen(0, '127.0.0.1');
          const response = await fetch(await app.getUrl());
          if (!response.ok || !(await response.json()).ok) throw new Error('HTTP_PROBE_FAILED');
        } finally { await app.close(); }
      })().catch(() => { process.exitCode = 1; });
    `;
    const result = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register/transpile-only', '-e', script],
      {
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          TS_NODE_PROJECT: resolve('libs/logger/tsconfig.lib.json'),
        },
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).not.toContain('N04_PRIVATE_HTTP_SENTINEL');
    expect(output).toContain('profile.operation');
    expect(output).toContain('diagnostic.rejected');
  }, 25_000);
});
