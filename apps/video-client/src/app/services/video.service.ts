import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Video {
  id: string;
  title: string;
  description?: string;
  assetId: string;
  thumbnailAssetId?: string;
  channelId: string;
  durationSeconds?: number;
  resolution?: string;
  encoding?: string;
  viewCount: number;
  likeCount: number;
  visibility: 'public' | 'unlisted' | 'private';
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  channel?: Channel;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  profileId: string;
  userId: string;
  bannerAssetId?: string;
  avatarAssetId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelSubscription {
  id: string;
  channelId: string;
  userId: string;
  profileId: string;
  subscribedAt: Date;
}

export interface CreateVideoDto {
  title: string;
  description?: string;
  assetId: string;
  thumbnailAssetId?: string;
  channelId: string;
  durationSeconds?: number;
  resolution?: string;
  encoding?: string;
  visibility?: 'public' | 'unlisted' | 'private';
}

export interface CreateChannelDto {
  name: string;
  description?: string;
  profileId: string;
  userId: string;
  bannerAssetId?: string;
  avatarAssetId?: string;
}

export interface SubscribeDto {
  channelId: string;
  userId: string;
  profileId: string;
}

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private readonly API_URL = '/api/videos';

  constructor(private http: HttpClient) {}

  // Video operations
  getVideos(): Observable<Video[]> {
    return this.http.get<Video[]>(this.API_URL);
  }

  getVideo(id: string): Observable<Video> {
    return this.http.get<Video>(`${this.API_URL}/${id}`);
  }

  getRecommendedVideos(limit?: number): Observable<Video[]> {
    const url = limit
      ? `${this.API_URL}/recommended?limit=${limit}`
      : `${this.API_URL}/recommended`;
    return this.http.get<Video[]>(url);
  }

  getTrendingVideos(limit?: number): Observable<Video[]> {
    const url = limit
      ? `${this.API_URL}/trending?limit=${limit}`
      : `${this.API_URL}/trending`;
    return this.http.get<Video[]>(url);
  }

  getChannelVideos(channelId: string): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.API_URL}/channel/${channelId}`);
  }

  createVideo(video: CreateVideoDto): Observable<Video> {
    return this.http.post<Video>(this.API_URL, video);
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
  getChannels(): Observable<Channel[]> {
    return this.http.get<Channel[]>(`${this.API_URL}/channels`);
  }

  getChannel(id: string): Observable<Channel> {
    return this.http.get<Channel>(`${this.API_URL}/channels/${id}`);
  }

  getUserChannels(userId: string): Observable<Channel[]> {
    return this.http.get<Channel[]>(`${this.API_URL}/channels/user/${userId}`);
  }

  createChannel(channel: CreateChannelDto): Observable<Channel> {
    return this.http.post<Channel>(`${this.API_URL}/channels`, channel);
  }

  // Subscription operations
  subscribeToChannel(subscription: SubscribeDto): Observable<ChannelSubscription> {
    return this.http.post<ChannelSubscription>(
      `${this.API_URL}/subscriptions`,
      subscription
    );
  }

  unsubscribeFromChannel(channelId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/subscriptions/${channelId}`, {
      body: { userId },
    });
  }

  getUserSubscriptions(userId: string): Observable<ChannelSubscription[]> {
    return this.http.get<ChannelSubscription[]>(
      `${this.API_URL}/subscriptions/user/${userId}`
    );
  }

  getChannelSubscribers(channelId: string): Observable<ChannelSubscription[]> {
    return this.http.get<ChannelSubscription[]>(
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
