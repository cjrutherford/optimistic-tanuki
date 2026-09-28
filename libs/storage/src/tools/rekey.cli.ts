import { StorageRekeyService } from '../lib/storage-rekey.service';

type CliOptions = {
  dir?: string;
  dryRun: boolean;
  backupDir?: string;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = { dryRun: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dir' && argv[index + 1]) {
      options.dir = argv[index + 1];
      index += 1;
    } else if (arg === '--apply') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--backup-dir' && argv[index + 1]) {
      options.backupDir = argv[index + 1];
      index += 1;
    }
  }
  return options;
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  if (!options.dir) {
    console.error(
      'Usage: rekey --dir <storage-path> [--apply] [--backup-dir <path>]'
    );
    console.error('Without --apply this is a dry run that changes nothing.');
    process.exitCode = 2;
    return;
  }
  const service = new StorageRekeyService();
  const report = await service.rekeyLocalDirectory(options.dir, {
    dryRun: options.dryRun,
    backupDir: options.backupDir,
  });
  for (const entry of report.entries) {
    const detail = entry.error ? ` (${entry.error})` : '';
    console.log(`${entry.status} ${entry.location}${detail}`);
  }
  console.log(
    `scanned=${report.scanned} encrypted=${report.encrypted} failed=${report.failed} dryRun=${options.dryRun}`
  );
  if (report.failed > 0) {
    process.exitCode = 1;
  }
};

void main();
