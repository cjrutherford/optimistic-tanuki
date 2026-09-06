import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { ClassifiedService } from './classified.service';
import { ClassifiedAdDto, CreateClassifiedAdDto } from '../models/index';

describe('ClassifiedService', () => {
  let service: ClassifiedService;
  let httpMock: HttpTestingController;

  const mockAd: ClassifiedAdDto = {
    id: 'ad-1',
    communityId: 'community-1',
    profileId: 'profile-1',
    userId: 'user-1',
    sellerProfileName: 'Seller',
    sellerProfilePic: null,
    title: 'Bike',
    description: 'A nice bike',
    price: 100,
    currency: 'USD',
    category: 'Sports',
    condition: 'Good',
    imageUrls: [],
    status: 'active',
    isFeatured: false,
    featuredUntil: null,
    appScope: 'classifieds',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ClassifiedService],
    });
    service = TestBed.inject(ClassifiedService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('create posts a new classified ad', async () => {
    const dto: CreateClassifiedAdDto = {
      title: 'Bike',
      description: 'A nice bike',
      price: 100,
    };

    const promise = service.create(dto);
    const req = httpMock.expectOne('/api/classifieds');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(mockAd);

    await expect(promise).resolves.toEqual(mockAd);
  });

  it('findById retrieves an ad by id', async () => {
    const promise = service.findById('ad-1');
    const req = httpMock.expectOne('/api/classifieds/ad-1');
    expect(req.request.method).toBe('GET');
    req.flush(mockAd);

    await expect(promise).resolves.toEqual(mockAd);
  });

  it('findByCommunity requests without query params when none are given', async () => {
    const paginated = {
      data: [mockAd],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    };

    const promise = service.findByCommunity('community-1');
    const req = httpMock.expectOne('/api/classifieds/community/community-1');
    expect(req.request.method).toBe('GET');
    req.flush(paginated);

    await expect(promise).resolves.toEqual(paginated);
  });

  it('findByCommunity includes page and pageSize as query params when given', async () => {
    const paginated = {
      data: [],
      total: 0,
      page: 2,
      pageSize: 5,
      totalPages: 0,
    };

    const promise = service.findByCommunity('community-1', {
      page: 2,
      pageSize: 5,
    });
    const req = httpMock.expectOne(
      '/api/classifieds/community/community-1?page=2&pageSize=5'
    );
    expect(req.request.method).toBe('GET');
    req.flush(paginated);

    await expect(promise).resolves.toEqual(paginated);
  });

  it('findByCommunityFlat retrieves a flat list for a community', async () => {
    const promise = service.findByCommunityFlat('community-1');
    const req = httpMock.expectOne('/api/classifieds/community/community-1');
    expect(req.request.method).toBe('GET');
    req.flush([mockAd]);

    await expect(promise).resolves.toEqual([mockAd]);
  });

  it('search posts search criteria', async () => {
    const dto = { query: 'bike' };
    const promise = service.search(dto);
    const req = httpMock.expectOne('/api/classifieds/search');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush([mockAd]);

    await expect(promise).resolves.toEqual([mockAd]);
  });

  it('update puts changes to an existing ad', async () => {
    const dto = { title: 'Updated Bike' };
    const promise = service.update('ad-1', dto);
    const req = httpMock.expectOne('/api/classifieds/ad-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(dto);
    req.flush({ ...mockAd, title: 'Updated Bike' });

    await expect(promise).resolves.toEqual({
      ...mockAd,
      title: 'Updated Bike',
    });
  });

  it('remove deletes an ad', async () => {
    const promise = service.remove('ad-1');
    const req = httpMock.expectOne('/api/classifieds/ad-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    await expect(promise).resolves.toBeNull();
  });

  it('markSold marks an ad as sold', async () => {
    const promise = service.markSold('ad-1');
    const req = httpMock.expectOne('/api/classifieds/ad-1/sold');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ...mockAd, status: 'sold' });

    await expect(promise).resolves.toEqual({ ...mockAd, status: 'sold' });
  });

  it('feature marks an ad as featured for a duration', async () => {
    const promise = service.feature('ad-1', 7);
    const req = httpMock.expectOne('/api/classifieds/ad-1/feature');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ durationDays: 7 });
    req.flush({ ...mockAd, isFeatured: true });

    await expect(promise).resolves.toEqual({ ...mockAd, isFeatured: true });
  });

  it('myAds retrieves the current profile ads', async () => {
    const promise = service.myAds();
    const req = httpMock.expectOne('/api/classifieds/profile/my-ads');
    expect(req.request.method).toBe('GET');
    req.flush([mockAd]);

    await expect(promise).resolves.toEqual([mockAd]);
  });
});
