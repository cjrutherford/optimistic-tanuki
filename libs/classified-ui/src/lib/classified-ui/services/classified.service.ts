import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ClassifiedAdDto,
  CreateClassifiedAdDto,
  UpdateClassifiedAdDto,
  SearchClassifiedsDto,
} from '../models/index';

@Injectable({
  providedIn: 'root',
})
export class ClassifiedService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/classifieds';

  create(dto: CreateClassifiedAdDto): Promise<ClassifiedAdDto> {
    return firstValueFrom(
      this.http.post<ClassifiedAdDto>(`${this.baseUrl}`, dto)
    );
  }

  findById(id: string): Promise<ClassifiedAdDto> {
    return firstValueFrom(
      this.http.get<ClassifiedAdDto>(`${this.baseUrl}/${id}`)
    );
  }

  findByCommunity(communityId: string): Promise<ClassifiedAdDto[]> {
    return firstValueFrom(
      this.http.get<ClassifiedAdDto[]>(
        `${this.baseUrl}/community/${communityId}`
      )
    );
  }

  search(dto: SearchClassifiedsDto): Promise<ClassifiedAdDto[]> {
    return firstValueFrom(
      this.http.post<ClassifiedAdDto[]>(`${this.baseUrl}/search`, dto)
    );
  }

  update(id: string, dto: UpdateClassifiedAdDto): Promise<ClassifiedAdDto> {
    return firstValueFrom(
      this.http.put<ClassifiedAdDto>(`${this.baseUrl}/${id}`, dto)
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }

  markSold(id: string): Promise<ClassifiedAdDto> {
    return firstValueFrom(
      this.http.post<ClassifiedAdDto>(`${this.baseUrl}/${id}/sold`, {})
    );
  }

  feature(id: string, durationDays: number): Promise<ClassifiedAdDto> {
    return firstValueFrom(
      this.http.post<ClassifiedAdDto>(`${this.baseUrl}/${id}/feature`, {
        durationDays,
      })
    );
  }

  myAds(): Promise<ClassifiedAdDto[]> {
    return firstValueFrom(
      this.http.get<ClassifiedAdDto[]>(`${this.baseUrl}/profile/my-ads`)
    );
  }
}
