import { Injectable } from '@nestjs/common';
import * as net from 'node:net';
import { createHmac } from 'node:crypto';

export interface VideoTranscodeRequest {
  videoId: string;
  sourcePath: string;
}

export interface VideoTranscodeResult {
  playbackPath: string;
  hlsManifestPath: string;
  hlsSegmentPaths: string[];
  durationSeconds?: number;
  resolution?: string;
  encoding?: string;
}

type VideoTranscodeResponse =
  | { ok: true; result: VideoTranscodeResult }
  | { ok: false; error: string };

@Injectable()
export class VideoTranscodeClientService {
  private readonly host =
    process.env['VIDEO_TRANSCODER_HOST'] || 'video-transcoder-worker';
  private readonly port = Number.parseInt(
    process.env['VIDEO_TRANSCODER_PORT'] || '3023',
    10
  );

  async transcode(
    request: VideoTranscodeRequest
  ): Promise<VideoTranscodeResult> {
    const response = await this.sendRequest({
      command: 'transcode-video',
      request,
    });

    if (!response.ok) {
      throw new Error(
        'error' in response ? response.error : 'Transcode failed'
      );
    }

    return response.result;
  }

  async fenceVideo(videoId: string, operationId: string): Promise<void> {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const key = process.env['VIDEO_TRANSCODER_DELETION_SECRET'];
    if (
      !uuid.test(videoId) ||
      !uuid.test(operationId) ||
      !key ||
      Buffer.byteLength(key) < 32
    )
      throw new Error('VIDEO_DELETION_CAPABILITY_UNAVAILABLE');
    const expiresAt = Math.floor(Date.now() / 1000) + 30;
    const signature = createHmac('sha256', key)
      .update(`ot-video-deletion-v1:${operationId}:${videoId}:${expiresAt}`)
      .digest('hex');
    const reply: unknown = await this.sendRequest({
      command: 'fence-video',
      request: { videoId, operationId, expiresAt, signature },
    });
    const value = reply as {
      ok?: unknown;
      deletion?: {
        videoId?: unknown;
        verifiedAbsent?: unknown;
        fenced?: unknown;
      };
    };
    if (
      !value ||
      value.ok !== true ||
      value.deletion?.videoId !== videoId ||
      value.deletion.verifiedAbsent !== true ||
      value.deletion.fenced !== true
    )
      throw new Error('VIDEO_DELETION_OUTPUT_UNVERIFIED');
  }

  private sendRequest(payload: object): Promise<VideoTranscodeResponse> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this.host,
        port: this.port,
      });

      let buffer = '';
      const deadline =
        'command' in payload && payload.command === 'fence-video'
          ? setTimeout(() => {
              socket.destroy();
              reject(new Error('VIDEO_TRANSCODER_TIMEOUT'));
            }, 15000)
          : undefined;
      socket.once('close', () => {
        clearTimeout(deadline);
        if (!buffer.includes('\n'))
          reject(new Error('VIDEO_TRANSCODER_TRUNCATED'));
      });

      socket.setEncoding('utf8');
      socket.on('connect', () => {
        socket.write(`${JSON.stringify(payload)}\n`);
      });
      socket.on('data', (chunk) => {
        buffer += chunk;
        if (Buffer.byteLength(buffer) > 1024 * 1024) {
          socket.destroy();
          reject(new Error('VIDEO_TRANSCODER_RESPONSE_LIMIT'));
          return;
        }
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) {
          return;
        }

        const message = buffer.slice(0, newlineIndex);
        socket.end();

        try {
          resolve(JSON.parse(message) as VideoTranscodeResponse);
        } catch (error) {
          reject(error);
        }
      });
      socket.on('error', (error) => {
        reject(error);
      });
    });
  }
}
