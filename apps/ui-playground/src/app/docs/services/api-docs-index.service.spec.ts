import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ApiDocsIndexService } from './api-docs-index.service';

describe('ApiDocsIndexService', () => {
  let service: ApiDocsIndexService;
  let httpMock: HttpTestingController;

  const index = {
    generatedAt: '2026-05-25T00:00:00.000Z',
    items: [
      {
        slug: 'common-ui',
        name: 'Common UI',
        packageName: '@optimistic-tanuki/common-ui',
        summary: 'Shared Angular primitives.',
        sourceRoot: 'libs/common-ui/src/lib/common-ui',
        readmePath: 'libs/common-ui/README.md',
        outputPath: 'apps/ui-playground/public/generated/compodoc/common-ui',
        url: '/generated/compodoc/common-ui/index.html',
        available: true,
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ApiDocsIndexService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the generated compodoc index and resolves entries by slug', async () => {
    const indexPromise = firstValueFrom(service.getIndex());
    const itemPromise = firstValueFrom(service.getBySlug('common-ui'));

    httpMock.expectOne('/generated/compodoc-index.json').flush(index);

    await expect(indexPromise).resolves.toEqual(index.items);
    await expect(itemPromise).resolves.toEqual(
      expect.objectContaining({ slug: 'common-ui', available: true })
    );
  });
});
