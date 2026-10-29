import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { ImageUploadService } from './image-upload.service';

describe('ImageUploadService audience context', () => {
  let http: { post: jest.Mock };

  beforeEach(() => {
    http = { post: jest.fn().mockReturnValue(of({ id: 'asset-id' })) };
    TestBed.configureTestingModule({
      providers: [
        ImageUploadService,
        { provide: HttpClient, useValue: http },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
  });

  it('carries a validated private audience hint on upload', async () => {
    const service = TestBed.inject(ImageUploadService);
    const restrictions = [{ type: 'owner' as const, profileId: 'profile-id' }];

    await expect(
      service.uploadBase64(
        'data:image/png;base64,AA==',
        'profile-id',
        'forum-image',
        restrictions
      )
    ).resolves.toBe('/api/asset/asset-id');

    expect(http.post).toHaveBeenCalledWith(
      '/api/asset',
      expect.objectContaining({
        name: 'forum-image',
        profileId: 'profile-id',
        audienceRestrictions: restrictions,
      })
    );
  });

  it('leaves ordinary public uploads without a restriction field', async () => {
    const service = TestBed.inject(ImageUploadService);

    await service.uploadBase64(
      'data:image/png;base64,AA==',
      'profile-id',
      'public-image'
    );

    expect(http.post).toHaveBeenCalledWith(
      '/api/asset',
      expect.not.objectContaining({ audienceRestrictions: expect.anything() })
    );
  });

  it('rejects oversized files before FileReader materializes base64', async () => {
    const service = TestBed.inject(ImageUploadService);
    const file = {
      name: 'large.mp4',
      type: 'video/mp4',
      size: 25 * 1024 * 1024 + 1,
    } as File;
    const readAsDataUrl = jest.spyOn(FileReader.prototype, 'readAsDataURL');

    await expect(service.uploadFile(file, 'profile-id')).rejects.toThrow(
      /25 MiB limit/i
    );
    expect(readAsDataUrl).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
    readAsDataUrl.mockRestore();
  });

  it('rejects oversized base64 payloads before posting them', async () => {
    const service = TestBed.inject(ImageUploadService);
    const payload = `data:video/mp4;base64,${'A'.repeat(35 * 1024 * 1024)}`;

    await expect(service.uploadBase64(payload, 'profile-id')).rejects.toThrow(
      /25 MiB limit/i
    );
    expect(http.post).not.toHaveBeenCalled();
  });
});
