import { Injectable } from '@nestjs/common';
import * as net from 'node:net';

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
    10,
  );

  async transcode(request: VideoTranscodeRequest): Promise<VideoTranscodeResult> {
    const response = await this.sendRequest({
      command: 'transcode-video',
      request,
    });

    if (!response.ok) {
      throw new Error('error' in response ? response.error : 'Transcode failed');
    }

    return response.result;
  }

  private sendRequest(payload: object): Promise<VideoTranscodeResponse> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this.host,
        port: this.port,
      });

      let buffer = '';

      socket.setEncoding('utf8');
      socket.on('connect', () => {
        socket.write(`${JSON.stringify(payload)}\n`);
      });
      socket.on('data', (chunk) => {
        buffer += chunk;
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
