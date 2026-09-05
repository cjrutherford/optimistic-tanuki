import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { AssetService } from './asset.service';

describe('AssetService', () => {
  let service: AssetService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AssetService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(AssetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('creates an asset via POST to the asset endpoint', async () => {
    const createPromise = service.createAsset({
      name: 'photo.png',
      profileId: 'profile-1',
      type: 'image',
      content: 'data:image/png;base64,AAA',
      fileExtension: 'png',
    });

    const req = httpMock.expectOne('/api/asset');
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'asset-1',
      name: 'photo.png',
      profileId: 'profile-1',
      type: 'image',
      storageStrategy: 'inline',
    });

    await expect(createPromise).resolves.toMatchObject({ id: 'asset-1' });
  });

  it('builds a direct asset URL', () => {
    expect(service.getAssetUrl('asset-42')).toBe('/api/asset/asset-42');
  });

  it('converts a File to a base64 data URL', async () => {
    const file = new File(['hello world'], 'hello.txt', {
      type: 'text/plain',
    });

    const result = await service.fileToDataUrl(file);
    expect(result).toContain('data:text/plain;base64,');
  });

  it('rejects when the file cannot be read', async () => {
    const file = new File(['x'], 'x.txt', { type: 'text/plain' });
    const originalReadAsDataURL = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (this: FileReader) {
      this.onerror?.(new ProgressEvent('error') as never);
    };

    await expect(service.fileToDataUrl(file)).rejects.toBeDefined();

    FileReader.prototype.readAsDataURL = originalReadAsDataURL;
  });

  it.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
    ['application/octet-stream', 'png'],
  ])('maps %s data URLs to the %s extension', (mime, expected) => {
    expect(service.getFileExtension(`data:${mime};base64,AAA`)).toBe(expected);
  });
});
