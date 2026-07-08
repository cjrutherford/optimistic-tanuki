import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  AudioProjectCommands,
  TrackCommands,
  MixCommands,
  GenerationCommands,
  ExportCommands,
  CollaborationMode,
} from '@optimistic-tanuki/constants';

describe('Audio Workstation Microservice E2E Tests', () => {
  let client: ClientProxy;

  const testUserId = 'e2e-test-user-' + Date.now();
  let createdProjectId: string;
  let createdTrackId: string;
  let createdGenerationId: string;
  let createdMixSnapshotId: string;
  let createdExportId: string;

  beforeAll(async () => {
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: 'localhost', port: 3025 },
    });

    for (let i = 0; i < 30; i++) {
      try {
        await client.connect();
        break;
      } catch (err) {
        console.log(`Connection attempt ${i + 1} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    console.log('Connected to audio-workstation');
  }, 60000);

  afterAll(async () => {
    // Cleanup: delete project and its contents
    if (createdProjectId) {
      try {
        await firstValueFrom(
          client.send(
            { cmd: AudioProjectCommands.DELETE },
            { id: createdProjectId, userId: testUserId }
          )
        );
        console.log('Cleaned up project:', createdProjectId);
      } catch (e) {
        console.warn('Failed to cleanup project', e);
      }
    }

    if (client) await client.close();
  });

  it('Step 1: Should create a new audio project', async () => {
    const payload = {
      userId: testUserId,
      data: {
        name: 'E2E Test Project',
        bpm: 128,
        key: 'Am',
        genre: 'Electronic',
        mood: 'Energetic',
      },
    };

    const project = await firstValueFrom(
      client.send({ cmd: AudioProjectCommands.CREATE }, payload)
    );

    expect(project).toBeDefined();
    expect(project.id).toBeDefined();
    expect(project.name).toBe('E2E Test Project');
    expect(project.bpm).toBe(128);
    expect(project.key).toBe('Am');
    expect(project.genre).toBe('Electronic');
    expect(project.userId).toBe(testUserId);

    createdProjectId = project.id;
    console.log('Created project:', createdProjectId);
  }, 30000);

  it('Step 2: Should get the created project', async () => {
    expect(createdProjectId).toBeDefined();

    const payload = {
      id: createdProjectId,
      userId: testUserId,
    };

    const project = await firstValueFrom(
      client.send({ cmd: AudioProjectCommands.GET }, payload)
    );

    expect(project).toBeDefined();
    expect(project.id).toBe(createdProjectId);
    expect(project.name).toBe('E2E Test Project');
  }, 15000);

  it('Step 3: Should list projects for the user', async () => {
    const payload = { userId: testUserId };

    const projects = await firstValueFrom(
      client.send({ cmd: AudioProjectCommands.LIST }, payload)
    );

    expect(projects).toBeDefined();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThanOrEqual(1);

    const found = projects.find((p: any) => p.id === createdProjectId);
    expect(found).toBeDefined();
    console.log('Found project in list:', found.id);
  }, 15000);

  it('Step 4: Should update the project', async () => {
    const payload = {
      id: createdProjectId,
      userId: testUserId,
      data: { name: 'E2E Test Project Updated', bpm: 140 },
    };

    const updated = await firstValueFrom(
      client.send({ cmd: AudioProjectCommands.UPDATE }, payload)
    );

    expect(updated).toBeDefined();
    expect(updated.name).toBe('E2E Test Project Updated');
    expect(updated.bpm).toBe(140);
    console.log('Updated project:', updated.name);
  }, 15000);

  it('Step 5: Should create a track in the project', async () => {
    const payload = {
      projectId: createdProjectId,
      name: 'Main Synth',
      type: 'synth',
      volume: -6,
      pan: 0,
    };

    const track = await firstValueFrom(
      client.send({ cmd: TrackCommands.CREATE }, payload)
    );

    expect(track).toBeDefined();
    expect(track.id).toBeDefined();
    expect(track.name).toBe('Main Synth');
    expect(track.type).toBe('synth');
    expect(track.projectId).toBe(createdProjectId);

    createdTrackId = track.id;
    console.log('Created track:', createdTrackId);
  }, 15000);

  it('Step 6: Should list tracks for the project', async () => {
    const payload = { projectId: createdProjectId };

    const tracks = await firstValueFrom(
      client.send({ cmd: TrackCommands.LIST }, payload)
    );

    expect(tracks).toBeDefined();
    expect(Array.isArray(tracks)).toBe(true);
    expect(tracks.length).toBeGreaterThanOrEqual(1);

    const found = tracks.find((t: any) => t.id === createdTrackId);
    expect(found).toBeDefined();
    console.log('Found track in list:', found.id);
  }, 15000);

  it('Step 7: Should update the track', async () => {
    const payload = {
      id: createdTrackId,
      data: { volume: -3, muted: false, name: 'Main Synth Updated' },
    };

    const updated = await firstValueFrom(
      client.send({ cmd: TrackCommands.UPDATE }, payload)
    );

    expect(updated).toBeDefined();
    expect(updated.volume).toBe(-3);
    expect(updated.name).toBe('Main Synth Updated');
    console.log('Updated track:', updated.name);
  }, 15000);

  it('Step 8: Should request a generation', async () => {
    const data = {
      projectId: createdProjectId,
      collaborationMode: CollaborationMode.FULL_AUTO,
      prompt: 'Upbeat electronic track with powerful bass',
      parameters: {
        bpm: 128,
        key: 'Am',
        genre: 'Electronic',
        mood: 'Energetic',
        duration: 180,
      },
    };

    const payload = {
      userId: testUserId,
      data,
    };

    const generation = await firstValueFrom(
      client.send({ cmd: GenerationCommands.REQUEST }, payload)
    );

    expect(generation).toBeDefined();
    expect(generation.id).toBeDefined();
    expect(generation.status).toBe('pending');

    createdGenerationId = generation.id;
    console.log('Created generation request:', createdGenerationId);
  }, 15000);

  it('Step 9: Should get generation status', async () => {
    expect(createdGenerationId).toBeDefined();

    const payload = { id: createdGenerationId };

    const status = await firstValueFrom(
      client.send({ cmd: GenerationCommands.STATUS }, payload)
    );

    expect(status).toBeDefined();
    expect(status.id).toBe(createdGenerationId);
    expect(['pending', 'processing', 'completed', 'failed']).toContain(
      status.status
    );
    console.log('Generation status:', status.status);
  }, 15000);

  it('Step 10: Should list generations for the project', async () => {
    const payload = { projectId: createdProjectId };

    const generations = await firstValueFrom(
      client.send({ cmd: GenerationCommands.LIST }, payload)
    );

    expect(generations).toBeDefined();
    expect(Array.isArray(generations)).toBe(true);
    expect(generations.length).toBeGreaterThanOrEqual(1);
    console.log('Found', generations.length, 'generations');
  }, 15000);

  it('Step 11: Should save a mix snapshot', async () => {
    const data = {
      projectId: createdProjectId,
      trackId: createdTrackId,
      volume: -3,
      pan: 0.2,
      eq: { lowGain: 0, midGain: 1, highGain: -0.5 },
      dynamics: { threshold: -18, ratio: 3, attack: 5, release: 50 },
      effects: { reverbMix: 0.15, delayMix: 0.1 },
    };

    const payload = {
      userId: testUserId,
      data,
    };

    const mix = await firstValueFrom(
      client.send({ cmd: MixCommands.SAVE }, payload)
    );

    expect(mix).toBeDefined();
    expect(mix.volume).toBe(-3);
    expect(mix.pan).toBe(0.2);

    createdMixSnapshotId = mix.id;
    console.log('Saved mix snapshot:', createdMixSnapshotId);
  }, 15000);

  it('Step 12: Should list mix snapshots for the project', async () => {
    const payload = { projectId: createdProjectId };

    const mixes = await firstValueFrom(
      client.send({ cmd: MixCommands.LIST }, payload)
    );

    expect(mixes).toBeDefined();
    expect(Array.isArray(mixes)).toBe(true);
    console.log('Found', mixes.length, 'mix snapshots');
  }, 15000);

  it('Step 13: Should start an export', async () => {
    const data = {
      projectId: createdProjectId,
      format: 'wav' as const,
      quality: 'high' as const,
      includeStems: false,
    };

    const payload = {
      userId: testUserId,
      projectId: createdProjectId,
      data,
    };

    const exportJob = await firstValueFrom(
      client.send({ cmd: ExportCommands.START }, payload)
    );

    expect(exportJob).toBeDefined();
    expect(exportJob.id).toBeDefined();
    expect(exportJob.status).toBe('pending');
    expect(exportJob.format).toBe('wav');

    createdExportId = exportJob.id;
    console.log('Started export:', createdExportId);
  }, 15000);

  it('Step 14: Should get export status', async () => {
    expect(createdExportId).toBeDefined();

    const payload = { id: createdExportId };

    const status = await firstValueFrom(
      client.send({ cmd: ExportCommands.STATUS }, payload)
    );

    expect(status).toBeDefined();
    expect(status.id).toBe(createdExportId);
    console.log('Export status:', status.status);
  }, 15000);

  it('Step 15: Should list exports for the project', async () => {
    const payload = { projectId: createdProjectId };

    const exports = await firstValueFrom(
      client.send({ cmd: ExportCommands.LIST }, payload)
    );

    expect(exports).toBeDefined();
    expect(Array.isArray(exports)).toBe(true);
    expect(exports.length).toBeGreaterThanOrEqual(1);
    console.log('Found', exports.length, 'exports');
  }, 15000);

  it('Step 16: Should delete the track', async () => {
    expect(createdTrackId).toBeDefined();

    const payload = { id: createdTrackId };

    await firstValueFrom(client.send({ cmd: TrackCommands.DELETE }, payload));

    // Verify track is deleted
    const tracksPayload = { projectId: createdProjectId };
    const tracks = await firstValueFrom(
      client.send({ cmd: TrackCommands.LIST }, tracksPayload)
    );
    const found = tracks.find((t: any) => t.id === createdTrackId);
    expect(found).toBeUndefined();
    console.log('Deleted track:', createdTrackId);
  }, 15000);
});
