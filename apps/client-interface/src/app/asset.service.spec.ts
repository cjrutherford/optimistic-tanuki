import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AssetService } from './asset.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('AssetService', () => {
  let service: AssetService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AssetService,
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    service = TestBed.inject(AssetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('posts a new asset to the asset endpoint', (done) => {
    const dto = {
      name: 'pic.png',
      profileId: 'p1',
      type: 'image',
      content: 'data:image/png;base64,AAA',
      fileExtension: 'png',
    } as never;
    service.createAsset(dto).subscribe((res) => {
      expect(res.id).toBe('a1');
      done();
    });
    const req = httpMock.expectOne('http://api.test/asset');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(dto);
    req.flush({ id: 'a1' });
  });

  it('builds an asset url from the base url', () => {
    expect(service.getAssetUrl('a1')).toBe('http://api.test/asset/a1');
  });

  it('deletes an asset', (done) => {
    service.deleteAsset('a1').subscribe(() => done());
    const req = httpMock.expectOne('http://api.test/asset/a1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  describe('dataUrlToBlob', () => {
    it('decodes a base64 data url into a blob with the declared mime type', () => {
      const base64 = Buffer.from('hello').toString('base64');
      const blob = service.dataUrlToBlob(`data:text/plain;base64,${base64}`);
      expect(blob.type).toBe('text/plain');
      expect(blob.size).toBe(5);
    });

    it('falls back to octet-stream when the mime type cannot be parsed', () => {
      const base64 = Buffer.from('hi').toString('base64');
      const blob = service.dataUrlToBlob(`data,${base64}`);
      expect(blob.type).toBe('application/octet-stream');
    });
  });

  describe('getFileExtensionFromDataUrl', () => {
    it.each([
      ['data:image/png;base64,AA', 'png'],
      ['data:image/jpeg;base64,AA', 'jpg'],
      ['data:image/jpg;base64,AA', 'jpg'],
      ['data:image/gif;base64,AA', 'gif'],
      ['data:image/webp;base64,AA', 'webp'],
      ['data:image/svg+xml;base64,AA', 'svg'],
    ])('maps %s to %s', (url, expected) => {
      expect(service.getFileExtensionFromDataUrl(url)).toBe(expected);
    });

    it('returns an empty string for a nullish data url', () => {
      expect(service.getFileExtensionFromDataUrl(null)).toBe('');
      expect(service.getFileExtensionFromDataUrl(undefined)).toBe('');
    });

    it('defaults to png for unknown mime types', () => {
      expect(
        service.getFileExtensionFromDataUrl('data:application/pdf;base64,AA')
      ).toBe('png');
    });
  });
});
