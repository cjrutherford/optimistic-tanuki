import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { ApiDocsIndexItem } from '../models/docs.models';

interface ApiDocsIndexResponse {
  generatedAt: string;
  items: ApiDocsIndexItem[];
}

@Injectable({ providedIn: 'root' })
export class ApiDocsIndexService {
  private readonly http = inject(HttpClient);
  private readonly index$ = this.http
    .get<ApiDocsIndexResponse>('/generated/compodoc-index.json')
    .pipe(
      map((response) => response.items),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  getIndex(): Observable<ApiDocsIndexItem[]> {
    return this.index$;
  }

  getBySlug(slug: string): Observable<ApiDocsIndexItem | null> {
    return this.getIndex().pipe(
      map((items) => items.find((item) => item.slug === slug) ?? null)
    );
  }
}
