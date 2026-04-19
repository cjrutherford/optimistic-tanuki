import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  assessVideoImport,
  discoverSeedVideoFiles,
  deriveChannelName,
  deriveVideoTitle,
  getRelativeImportPath,
} from './seed-videos.helpers';

describe('seed video helpers', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'videos-seed-'));

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('discovers supported video files recursively in a stable order', async () => {
    const root = join(tempRoot, 'library');
    mkdirSync(join(root, 'Drama', 'Season 1'), { recursive: true });
    mkdirSync(join(root, 'Comedy'), { recursive: true });

    writeFileSync(join(root, 'Drama', 'Season 1', 'Episode 02.mp4'), 'a');
    writeFileSync(join(root, 'Drama', 'Season 1', 'Episode 01.mkv'), 'a');
    writeFileSync(join(root, 'Comedy', 'Special.avi'), 'a');
    writeFileSync(join(root, 'Comedy', 'notes.txt'), 'ignore');

    const files = await discoverSeedVideoFiles(root);

    expect(files.map((file) => getRelativeImportPath(root, file))).toEqual([
      'Drama/Season 1/Episode 02.mp4',
    ]);
  });

  it('stops discovery after the requested number of supported files', async () => {
    const root = join(tempRoot, 'limited-library');
    const restrictedDir = join(root, 'Zeta');
    mkdirSync(join(root, 'Alpha'), { recursive: true });
    mkdirSync(restrictedDir, { recursive: true });
    writeFileSync(join(root, 'Alpha', 'Episode 01.mp4'), 'a');
    chmodSync(restrictedDir, 0o000);

    try {
      const files = await discoverSeedVideoFiles(root, { maxFiles: 1 });

      expect(files.map((file) => getRelativeImportPath(root, file))).toEqual([
        'Alpha/Episode 01.mp4',
      ]);
    } finally {
      chmodSync(restrictedDir, 0o700);
    }
  });

  it('derives readable titles from filenames', () => {
    expect(
      deriveVideoTitle('/mnt/valhalla/media/TV/Show_Name/S01E02 - Pilot.mp4'),
    ).toBe('S01E02 Pilot');
    expect(
      deriveVideoTitle('/mnt/valhalla/media/TV/Show.Name.Part.1.mkv'),
    ).toBe('Show Name Part 1');
  });

  it('uses the top-level folder as the channel name', () => {
    expect(
      deriveChannelName(
        '/mnt/valhalla/media/TV',
        '/mnt/valhalla/media/TV/Mystery Science Theater/Season 01/Episode 01.mp4',
      ),
    ).toBe('Mystery Science Theater');
    expect(
      deriveChannelName(
        '/mnt/valhalla/media/TV',
        '/mnt/valhalla/media/TV/LooseMovie.mp4',
      ),
    ).toBe('Imported TV');
  });

  it('marks unsupported extensions as not importable', () => {
    expect(assessVideoImport('/tmp/show.mkv', 1024)).toEqual({
      canImport: false,
      reason:
        'unsupported extension .mkv; supported extensions: .mp4, .mpeg, .mov, .webm',
    });
  });

  it('allows supported files larger than the previous asset size limit', () => {
    expect(assessVideoImport('/tmp/show.mp4', 101 * 1024 * 1024)).toEqual({
      canImport: true,
    });
  });

  it('allows supported files within the asset size limit', () => {
    expect(assessVideoImport('/tmp/show.mp4', 10 * 1024 * 1024)).toEqual({
      canImport: true,
    });
  });
});
