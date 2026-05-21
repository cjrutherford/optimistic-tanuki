import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import {
  DocsCategory,
  DocsManifest,
  DocsManifestItem,
  DocsSearchDocument,
} from '../models/docs.models';
import { categoryTitle, normalizeDocSlug } from '../utils/docs-slug';

@Injectable({ providedIn: 'root' })
export class DocsIndexService {
  private readonly http = inject(HttpClient);
  private readonly manifest$ = this.http
    .get<DocsManifest>('/generated/docs-manifest.json')
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  getManifest(): Observable<DocsManifest> {
    return this.manifest$;
  }

  getAllItems(): Observable<DocsManifestItem[]> {
    return this.getManifest().pipe(
      map((manifest) =>
        [...manifest.items].sort(
          (left, right) =>
            (left.order ?? 999) - (right.order ?? 999) ||
            left.title.localeCompare(right.title)
        )
      )
    );
  }

  getDocs(): Observable<DocsManifestItem[]> {
    return this.getAllItems().pipe(
      map((items) => items.filter((item) => item.kind === 'doc'))
    );
  }

  getSearchDocuments(): Observable<DocsSearchDocument[]> {
    return this.getAllItems().pipe(
      map((items) =>
        items.map((item) => ({
          slug: item.slug,
          title: item.title,
          summary: item.summary,
          category: item.category,
          headings: item.headings,
          tags: item.tags,
        }))
      )
    );
  }

  getCategories(): Observable<DocsCategory[]> {
    return this.getDocs().pipe(
      map((docs) => {
        const grouped = new Map<string, DocsManifestItem[]>();

        for (const doc of docs) {
          const category = normalizeDocSlug(doc.category || 'reference');
          grouped.set(category, [...(grouped.get(category) ?? []), doc]);
        }

        return [...grouped.entries()]
          .map(([id, documents]) => ({
            id,
            title: categoryTitle(id),
            documents: [...documents].sort(
              (left, right) =>
                (left.order ?? 999) - (right.order ?? 999) ||
                left.title.localeCompare(right.title)
            ),
          }))
          .sort(
            (left, right) =>
              (left.documents[0]?.order ?? 999) -
                (right.documents[0]?.order ?? 999) ||
              left.title.localeCompare(right.title)
          );
      })
    );
  }

  getDocBySlug(slug: string): Observable<DocsManifestItem | null> {
    const normalizedSlug = normalizeDocSlug(slug);
    return this.getAllItems().pipe(
      map(
        (items) =>
          items.find(
            (item) => normalizeDocSlug(item.slug) === normalizedSlug
          ) ?? null
      )
    );
  }

  getAdjacentDocs(slug: string): Observable<{
    previous: DocsManifestItem | null;
    next: DocsManifestItem | null;
  }> {
    const normalizedSlug = normalizeDocSlug(slug);
    return this.getDocs().pipe(
      map((docs) => {
        const index = docs.findIndex(
          (doc) => normalizeDocSlug(doc.slug) === normalizedSlug
        );

        return {
          previous: index > 0 ? docs[index - 1] : null,
          next: index >= 0 && index < docs.length - 1 ? docs[index + 1] : null,
        };
      })
    );
  }
}
