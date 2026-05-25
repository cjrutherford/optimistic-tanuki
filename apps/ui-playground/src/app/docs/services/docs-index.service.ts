import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, combineLatest, map, shareReplay } from 'rxjs';
import {
  DocsCategory,
  DocsManifest,
  DocsManifestItem,
  DocsSearchDocument,
} from '../models/docs.models';
import {
  categoryTitle,
  normalizeDocSlug,
  toCanonicalDocSlug,
} from '../utils/docs-slug';

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
          const category = normalizeDocSlug(
            doc.section || doc.category || 'reference'
          );
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

  getOperatorHubDocs(): Observable<DocsManifestItem[]> {
    return this.getDocs().pipe(
      map((docs) =>
        docs
          .filter(
            (doc) =>
              normalizeDocSlug(doc.section || '') === 'operators' ||
              normalizeDocSlug(doc.audience || '') === 'operator'
          )
          .sort(
            (left, right) =>
              Number(right.featured === true) -
                Number(left.featured === true) ||
              (left.order ?? 999) - (right.order ?? 999) ||
              left.title.localeCompare(right.title)
          )
      )
    );
  }

  getLibraryGuideDocs(): Observable<DocsManifestItem[]> {
    return this.getDocs().pipe(
      map((docs) =>
        docs
          .filter((doc) => doc.sourcePath.startsWith('libs/'))
          .sort(
            (left, right) =>
              (left.order ?? 999) - (right.order ?? 999) ||
              left.title.localeCompare(right.title)
          )
      )
    );
  }

  getDocBySlug(slug: string): Observable<DocsManifestItem | null> {
    const normalizedSlug = normalizeDocSlug(slug);
    const canonicalSlug = toCanonicalDocSlug(slug);
    return this.getAllItems().pipe(
      map(
        (items) =>
          items.find((item) => {
            const itemSlug = normalizeDocSlug(item.slug);
            return itemSlug === normalizedSlug || itemSlug === canonicalSlug;
          }) ?? null
      )
    );
  }

  getDocBySourcePath(sourcePath: string): Observable<DocsManifestItem | null> {
    return this.getAllItems().pipe(
      map(
        (items) =>
          items.find(
            (item) => item.sourcePath.toLowerCase() === sourcePath.toLowerCase()
          ) ?? null
      )
    );
  }

  getSectionDocs(section: string): Observable<DocsManifestItem[]> {
    const normalizedSection = normalizeDocSlug(section);
    return this.getDocs().pipe(
      map((docs) =>
        docs
          .filter(
            (doc) => normalizeDocSlug(doc.section || '') === normalizedSection
          )
          .sort(
            (left, right) =>
              (left.order ?? 999) - (right.order ?? 999) ||
              left.title.localeCompare(right.title)
          )
      )
    );
  }

  getAdjacentDocs(slug: string): Observable<{
    previous: DocsManifestItem | null;
    next: DocsManifestItem | null;
  }> {
    const normalizedSlug = normalizeDocSlug(slug);
    return combineLatest([this.getDocs(), this.getDocBySlug(slug)]).pipe(
      map(([docs, currentDoc]) => {
        const orderedDocs = currentDoc?.section
          ? docs.filter(
              (doc) =>
                normalizeDocSlug(doc.section || '') ===
                normalizeDocSlug(currentDoc.section || '')
            )
          : docs;
        const index = orderedDocs.findIndex(
          (doc) => normalizeDocSlug(doc.slug) === normalizedSlug
        );

        return {
          previous: index > 0 ? orderedDocs[index - 1] : null,
          next:
            index >= 0 && index < orderedDocs.length - 1
              ? orderedDocs[index + 1]
              : null,
        };
      })
    );
  }
}
