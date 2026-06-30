import { runOwnerBootstrapCli } from './owner-bootstrap-cli';

void runOwnerBootstrapCli().catch(() => {
  process.exitCode = 1;
});
