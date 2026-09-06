import { ClassifiedListComponent } from './classified-list.component';
import { ClassifiedAdDto } from '../models/index';

describe('ClassifiedListComponent', () => {
  let component: ClassifiedListComponent;

  const mockAd: ClassifiedAdDto = {
    id: 'ad-1',
    communityId: 'community-1',
    profileId: 'profile-1',
    userId: 'user-1',
    sellerProfileName: 'Jane Doe',
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
    component = new ClassifiedListComponent();
  });

  it('should be created with default inputs', () => {
    expect(component).toBeTruthy();
    expect(component.ads).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.showPostButton).toBe(false);
    expect(component.showContact).toBe(false);
  });

  it('emits postNew', () => {
    const spy = jest.fn();
    component.postNew.subscribe(spy);
    component.postNew.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('emits viewAd with the ad', () => {
    const spy = jest.fn();
    component.viewAd.subscribe(spy);
    component.viewAd.emit(mockAd);
    expect(spy).toHaveBeenCalledWith(mockAd);
  });

  it('emits contactSeller with the ad', () => {
    const spy = jest.fn();
    component.contactSeller.subscribe(spy);
    component.contactSeller.emit(mockAd);
    expect(spy).toHaveBeenCalledWith(mockAd);
  });

  it('accepts a list of ads', () => {
    component.ads = [mockAd];
    expect(component.ads).toHaveLength(1);
  });
});
