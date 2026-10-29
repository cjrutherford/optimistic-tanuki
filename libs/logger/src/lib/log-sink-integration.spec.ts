import { Logger } from '@nestjs/common';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emitSafeDiagnostic } from './safe-diagnostic';
import { verifyLogSinkDeletion } from './log-sink-deletion';

describe('Local diagnostic and declared-sink integration', () => {
  it('passes only safe metadata to the real Nest console sink', () => {
    const output: string[] = [];
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        output.push(String(chunk));
        return true;
      });
    try {
      emitSafeDiagnostic(new Logger('N04Fixture'), 'profile.operation', {
        outcome: 'failed',
        accountId: 'N04_PRIVATE_SENTINEL',
        error: new Error('N04_PRIVATE_SENTINEL'),
        url: '/private?token=N04_PRIVATE_SENTINEL',
      });
      expect(output.join('')).toContain('profile.operation');
      expect(output.join('')).not.toContain('N04_PRIVATE_SENTINEL');
    } finally {
      stdout.mockRestore();
    }
  });

  it('reads back a real fixture file, preserves counterparts and blocks an unsupported sink', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ot-n04-'));
    const file = join(directory, 'fixture.json');
    const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const counterpart = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    try {
      await writeFile(
        file,
        JSON.stringify([{ accountId }, { accountId: counterpart }])
      );
      const result = await verifyLogSinkDeletion(
        { accountId, profileIds: [] },
        [
          { id: 'fixture.file', deletionMode: 'account-keyed' },
          { id: 'operator.logs', deletionMode: 'operator-managed' },
        ],
        new Map([
          [
            'fixture.file',
            {
              purge: async (subject) => {
                const rows: { accountId: string }[] = JSON.parse(
                  await readFile(file, 'utf8')
                );
                await writeFile(
                  file,
                  JSON.stringify(
                    rows.filter((row) => row.accountId !== subject.accountId)
                  )
                );
              },
              readback: async (subject) => {
                const rows: { accountId: string }[] = JSON.parse(
                  await readFile(file, 'utf8')
                );
                return rows.filter((row) => row.accountId === subject.accountId)
                  .length;
              },
            },
          ],
        ])
      );
      expect(result.results.map((row) => row.code)).toEqual([
        'PURGE_VERIFIED',
        'PURGE_UNSUPPORTED',
      ]);
      expect(result.allDeclaredSinksVerified).toBe(false);
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([
        { accountId: counterpart },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
