import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import {
  VideoTranscodeClientService,
  VideoTranscodeRequest,
  VideoTranscodeResult,
} from './video-transcode-client.service';

jest.mock('node:net', () => ({
  createConnection: jest.fn(),
}));

// Stands in for the worker connection so each test can drive the
// connect/data/error sequence by hand instead of opening a real socket.
class FakeSocket extends EventEmitter {
  readonly setEncoding = jest.fn();
  readonly write = jest.fn();
  readonly end = jest.fn();
}

const createConnectionMock = net.createConnection as unknown as jest.Mock;

describe('VideoTranscodeClientService', () => {
  const request: VideoTranscodeRequest = {
    videoId: 'video-1',
    sourcePath: '/asset-root/assets/source-asset/upload.mkv',
  };
  const result: VideoTranscodeResult = {
    playbackPath: '/work/playback.mp4',
    hlsManifestPath: '/work/stream.m3u8',
    hlsSegmentPaths: ['/work/segment-000.ts'],
    durationSeconds: 95,
    resolution: '1920x1080',
    encoding: 'h264+aac',
  };

  const originalHost = process.env['VIDEO_TRANSCODER_HOST'];
  const originalPort = process.env['VIDEO_TRANSCODER_PORT'];
  let socket: FakeSocket;

  beforeEach(() => {
    socket = new FakeSocket();
    createConnectionMock.mockReset();
    createConnectionMock.mockReturnValue(socket);
  });

  afterEach(() => {
    // Listeners are registered per request; drop them so a stray emit cannot
    // settle a promise belonging to another test.
    socket.removeAllListeners();

    if (originalHost === undefined) {
      delete process.env['VIDEO_TRANSCODER_HOST'];
    } else {
      process.env['VIDEO_TRANSCODER_HOST'] = originalHost;
    }

    if (originalPort === undefined) {
      delete process.env['VIDEO_TRANSCODER_PORT'];
    } else {
      process.env['VIDEO_TRANSCODER_PORT'] = originalPort;
    }
  });

  // Host and port are read in property initialisers, so the environment has to
  // be in place before the service is constructed.
  const createService = (host?: string, port?: string) => {
    if (host === undefined) {
      delete process.env['VIDEO_TRANSCODER_HOST'];
    } else {
      process.env['VIDEO_TRANSCODER_HOST'] = host;
    }

    if (port === undefined) {
      delete process.env['VIDEO_TRANSCODER_PORT'];
    } else {
      process.env['VIDEO_TRANSCODER_PORT'] = port;
    }

    return new VideoTranscodeClientService();
  };

  it('sends a newline delimited transcode command to the configured worker', async () => {
    const service = createService('transcoder.internal', '4321');

    const pending = service.transcode(request);
    socket.emit('connect');
    socket.emit('data', `${JSON.stringify({ ok: true, result })}\n`);

    await expect(pending).resolves.toEqual(result);
    expect(createConnectionMock).toHaveBeenCalledWith({
      host: 'transcoder.internal',
      port: 4321,
    });
    expect(socket.setEncoding).toHaveBeenCalledWith('utf8');
    expect(socket.write).toHaveBeenCalledWith(
      `${JSON.stringify({ command: 'transcode-video', request })}\n`
    );
    expect(socket.end).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default worker host and port', async () => {
    const service = createService();

    const pending = service.transcode(request);
    socket.emit('connect');
    socket.emit('data', `${JSON.stringify({ ok: true, result })}\n`);

    await expect(pending).resolves.toEqual(result);
    expect(createConnectionMock).toHaveBeenCalledWith({
      host: 'video-transcoder-worker',
      port: 3023,
    });
  });

  it('buffers partial chunks until a full line arrives', async () => {
    const service = createService('transcoder.internal', '4321');
    const payload = JSON.stringify({ ok: true, result });

    const pending = service.transcode(request);
    socket.emit('connect');
    socket.emit('data', payload.slice(0, 20));

    // Nothing is parsed and the socket stays open while the line is incomplete.
    await Promise.resolve();
    expect(socket.end).not.toHaveBeenCalled();

    socket.emit('data', `${payload.slice(20)}\ntrailing-noise`);

    await expect(pending).resolves.toEqual(result);
    expect(socket.end).toHaveBeenCalledTimes(1);
  });

  it('throws the error reported by the worker', async () => {
    const service = createService('transcoder.internal', '4321');

    const pending = service.transcode(request);
    socket.emit('connect');
    socket.emit(
      'data',
      `${JSON.stringify({ ok: false, error: 'ffmpeg exited with 1' })}\n`
    );

    await expect(pending).rejects.toThrow('ffmpeg exited with 1');
  });

  it('throws a generic failure when the worker omits an error message', async () => {
    const service = createService('transcoder.internal', '4321');

    const pending = service.transcode(request);
    socket.emit('connect');
    socket.emit('data', `${JSON.stringify({ ok: false })}\n`);

    await expect(pending).rejects.toThrow('Transcode failed');
  });

  it('rejects when the worker sends a malformed line', async () => {
    const service = createService('transcoder.internal', '4321');

    const pending = service.transcode(request);
    socket.emit('connect');
    socket.emit('data', 'not-json\n');

    await expect(pending).rejects.toBeInstanceOf(SyntaxError);
    expect(socket.end).toHaveBeenCalledTimes(1);
  });

  it('rejects when the socket fails before a response arrives', async () => {
    const service = createService('transcoder.internal', '4321');

    const pending = service.transcode(request);
    socket.emit('error', new Error('connect ECONNREFUSED'));

    await expect(pending).rejects.toThrow('connect ECONNREFUSED');
    expect(socket.write).not.toHaveBeenCalled();
  });
});
