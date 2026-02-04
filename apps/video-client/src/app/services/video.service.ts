import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  VideoDto,
  ChannelDto,
  ChannelSubscriptionDto,
  CreateVideoDto,
  CreateChannelDto,
  SubscribeDto,
} from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private readonly API_URL = '/api/videos';

  constructor(private http: HttpClient) {}

  // Video operations
  getVideos(): Observable<VideoDto[]> {
    return this.http.get<VideoDto[]>(this.API_URL);
  }

  getVideo(id: string): Observable<VideoDto> {
    return this.http.get<VideoDto>(`${this.API_URL}/${id}`);
  }

  getRecommendedVideos(limit?: number): Observable<VideoDto[]> {
    const url = limit
      ? `${this.API_URL}/recommended?limit=${limit}`
      : `${this.API_URL}/recommended`;
    return this.http.get<VideoDto[]>(url);
  }

  getTrendingVideos(limit?: number): Observable<VideoDto[]> {
    const url = limit
      ? `${this.API_URL}/trending?limit=${limit}`
      : `${this.API_URL}/trending`;
    return this.http.get<VideoDto[]>(url);
  }

  createVideo(video: CreateVideoDto): Observable<VideoDto> {
    return this.http.post<VideoDto>(this.API_URL, video);
  }

  incrementViewCount(videoId: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/${videoId}/view`, {});
  }

  likeVideo(videoId: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/${videoId}/like`, {});
  }

  unlikeVideo(videoId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${videoId}/like`);
  }

  // Channel operations
  getChannels(): Observable<ChannelDto[]> {
    return this.http.get<ChannelDto[]>(`${this.API_URL}/channels`);
  }

  getChannel(id: string): Observable<ChannelDto> {
    return this.http.get<ChannelDto>(`${this.API_URL}/channels/${id}`);
  }

  getUserChannels(userId: string): Observable<ChannelDto[]> {
    return this.http.get<ChannelDto[]>(`${this.API_URL}/channels/user/${userId}`);
  }

  async getMyChannels(): Promise<ChannelDto[]> {
    return this.http.get<ChannelDto[]>(`${this.API_URL}/channels/my`).toPromise() as Promise<ChannelDto[]>;
  }

  async getChannelVideos(channelId: string): Promise<VideoDto[]> {
    return this.http.get<VideoDto[]>(`${this.API_URL}/channel/${channelId}`).toPromise() as Promise<VideoDto[]>;
  }

  createChannel(channel: CreateChannelDto): Promise<ChannelDto> {
    return this.http.post<ChannelDto>(`${this.API_URL}/channels`, channel).toPromise() as Promise<ChannelDto>;
  }

  // Subscription operations
  subscribeToChannel(subscription: SubscribeDto): Observable<ChannelSubscriptionDto> {
    return this.http.post<ChannelSubscriptionDto>(
      `${this.API_URL}/subscriptions`,
      subscription
    );
  }

  unsubscribeFromChannel(channelId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/subscriptions/${channelId}`, {
      body: { userId },
    });
  }

  getUserSubscriptions(userId: string): Observable<ChannelSubscriptionDto[]> {
    return this.http.get<ChannelSubscriptionDto[]>(
      `${this.API_URL}/subscriptions/user/${userId}`
    );
  }

  getChannelSubscribers(channelId: string): Observable<ChannelSubscriptionDto[]> {
    return this.http.get<ChannelSubscriptionDto[]>(
      `${this.API_URL}/subscriptions/channel/${channelId}`
    );
  }

  // Utility methods
  getAssetUrl(assetId: string): string {
    return `/api/asset/${assetId}`;
  }

  getVideoUrl(assetId: string): string {
    return `/api/asset/${assetId}`;
  }
}
