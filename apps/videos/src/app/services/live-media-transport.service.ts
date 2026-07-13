import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { LiveMediaTransportDto } from '@optimistic-tanuki/models';

interface CreateLiveMediaTransportInput {
  communityId: string;
  sessionId: string;
  expiresAt: Date;
}

@Injectable()
export class LiveMediaTransportService {
  createConnection(
    input: CreateLiveMediaTransportInput
  ): LiveMediaTransportDto | null {
    const url = process.env['LIVEKIT_URL'];
    const apiKey = process.env['LIVEKIT_API_KEY'];
    const apiSecret = process.env['LIVEKIT_API_SECRET'];
    if (!url || !apiKey || !apiSecret) {
      return null;
    }

    const roomName = `metrocast-${input.communityId}-${input.sessionId}`;
    const issuedAt = Math.floor(Date.now() / 1000);
    const token = this.signToken(
      {
        iss: apiKey,
        sub: `viewer-${randomUUID()}`,
        nbf: issuedAt,
        exp: Math.floor(input.expiresAt.getTime() / 1000),
        video: {
          room: roomName,
          roomJoin: true,
          canPublish: false,
          canSubscribe: true,
        },
      },
      apiSecret
    );

    return {
      type: 'livekit',
      serverUrl: this.normalizeServerUrl(url),
      roomName,
      token,
      expiresAt: input.expiresAt,
    };
  }

  private signToken(payload: Record<string, unknown>, secret: string): string {
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' })
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const unsignedToken = `${header}.${body}`;
    const signature = createHmac('sha256', secret)
      .update(unsignedToken)
      .digest('base64url');
    return `${unsignedToken}.${signature}`;
  }

  private normalizeServerUrl(url: string): string {
    const parsed = new URL(url);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return parsed.toString().replace(/\/$/, '');
  }
}
