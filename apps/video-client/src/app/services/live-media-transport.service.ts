import { Injectable } from '@angular/core';
import { LiveMediaTransportDto } from '@optimistic-tanuki/ui-models';
import { Room, RoomEvent, Track } from 'livekit-client';

@Injectable({ providedIn: 'root' })
export class LiveMediaTransportService {
  private room: Room | null = null;

  async connect(
    connection: LiveMediaTransportDto,
    videoElement: HTMLVideoElement
  ): Promise<void> {
    await this.disconnect();

    const room = new Room();
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video) {
        track.attach(videoElement);
      }
    });
    await room.connect(connection.serverUrl, connection.token);
    this.room = room;
  }

  async disconnect(): Promise<void> {
    if (!this.room) {
      return;
    }
    await this.room.disconnect();
    this.room = null;
  }
}
