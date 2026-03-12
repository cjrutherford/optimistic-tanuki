import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';

export interface ClassifiedAd {
  id: string;
  communityId: string;
  profileId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  images: string[];
  status: 'active' | 'sold' | 'expired' | 'removed';
  featured: boolean;
  featuredUntil?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class ClassifiedService {
  private http = inject(HttpClient);
  private apiBaseUrl = inject(API_BASE_URL);
  private baseUrl = `${this.apiBaseUrl}/communities`;

  getClassifieds(communitySlug: string): Promise<ClassifiedAd[]> {
    return firstValueFrom(
      this.http.get<ClassifiedAd[]>(`${this.baseUrl}/${communitySlug}/classifieds`)
    );
  }

  getClassifiedById(communitySlug: string, id: string): Promise<ClassifiedAd> {
    return firstValueFrom(
      this.http.get<ClassifiedAd>(`${this.baseUrl}/${communitySlug}/classifieds/${id}`)
    );
  }

  createClassified(communitySlug: string, data: Partial<ClassifiedAd>): Promise<ClassifiedAd> {
    return firstValueFrom(
      this.http.post<ClassifiedAd>(`${this.baseUrl}/${communitySlug}/classifieds`, data)
    );
  }

  updateClassified(communitySlug: string, id: string, data: Partial<ClassifiedAd>): Promise<ClassifiedAd> {
    return firstValueFrom(
      this.http.patch<ClassifiedAd>(`${this.baseUrl}/${communitySlug}/classifieds/${id}`, data)
    );
  }

  deleteClassified(communitySlug: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${communitySlug}/classifieds/${id}`)
    );
  }
}
