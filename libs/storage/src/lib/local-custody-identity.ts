import { constants } from 'node:fs';
import { lstat, mkdir, open, link, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Nonidentifying store marker. Independent node-local directories must not be
 * mistaken for one shared store when a shared database owns cleanup intent. */
export async function localCustodyIdentity(root: string): Promise<string> {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await lstat(root);
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    (directory.mode & 0o022) !== 0 ||
    (typeof process.getuid === 'function' && directory.uid !== process.getuid())
  )
    throw Error('CUSTODY_ROOT_INVALID');
  const path = join(root, '.ot-store-custody-v1');
  let existing = true;
  try {
    await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') existing = false;
    else throw error;
  }
  if (!existing) {
    const temp = join(root, '.ot-store-custody-' + randomUUID() + '.tmp');
    try {
      const file = await open(
        temp,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          (constants.O_NOFOLLOW ?? 0),
        0o600
      );
      try {
        await file.writeFile(randomUUID(), 'utf8');
        await file.sync();
      } finally {
        await file.close();
      }
      try {
        await link(temp, path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    } finally {
      await removeProbeFile(temp);
    }
  }
  const file = await open(
    path,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
  );
  try {
    const info = await file.stat();
    if (
      !info.isFile() ||
      info.size !== 36 ||
      (info.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && info.uid !== process.getuid())
    )
      throw Error('CUSTODY_MARKER_INVALID');
    const bytes = Buffer.alloc(37);
    const { bytesRead } = await file.read(bytes, 0, 37, 0);
    const id = bytes.subarray(0, bytesRead).toString('utf8');
    if (bytesRead !== 36 || !UUID.test(id))
      throw Error('CUSTODY_MARKER_INVALID');
    return 'local:' + id;
  } finally {
    await file.close();
  }
}

export type CustodyProbeMode = 'write' | 'read' | 'remove';
export async function localCustodyProbe(
  root: string,
  nonce: string,
  mode: CustodyProbeMode
): Promise<string> {
  if (!UUID.test(nonce) || !['write', 'read', 'remove'].includes(mode))
    throw Error('CUSTODY_PROBE_INVALID');
  const id = await localCustodyIdentity(root);
  const path = join(root, '.ot-store-probe-' + nonce);
  if (mode === 'write') {
    const file = await open(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        (constants.O_NOFOLLOW ?? 0),
      0o600
    );
    try {
      await file.writeFile(nonce, 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }
  } else if (mode === 'read') {
    const file = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    );
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size !== 36 || (info.mode & 0o077) !== 0)
        throw Error('CUSTODY_PROBE_INVALID');
      const bytes = Buffer.alloc(37);
      const { bytesRead } = await file.read(bytes, 0, 37, 0);
      if (bytesRead !== 36 || bytes.subarray(0, 36).toString('utf8') !== nonce)
        throw Error('CUSTODY_PROBE_INVALID');
    } finally {
      await file.close();
    }
  } else {
    try {
      await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return id;
}

async function removeProbeFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
