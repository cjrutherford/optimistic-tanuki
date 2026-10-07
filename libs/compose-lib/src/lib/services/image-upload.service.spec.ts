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
});
