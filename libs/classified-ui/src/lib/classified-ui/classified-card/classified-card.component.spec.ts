import { ClassifiedCardComponent } from './classified-card.component';
import { ClassifiedAdDto } from '../models/index';

describe('ClassifiedCardComponent', () => {
  let component: ClassifiedCardComponent;

  const baseAd: ClassifiedAdDto = {
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
    component = new ClassifiedCardComponent();
    component.ad = { ...baseAd };
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('sellerInitials', () => {
    it('derives initials from the seller name', () => {
      component.ad.sellerProfileName = 'Jane Doe';
      expect(component.sellerInitials).toBe('JD');
    });

    it('derives a single initial from a one-word name', () => {
      component.ad.sellerProfileName = 'Cher';
      expect(component.sellerInitials).toBe('C');
    });

    // NOTE: the component's fallback source is the literal 'CM' ("Community
    // member"), but the initials are derived by taking the first character of
    // each whitespace-separated word. Since 'CM' is a single word, the getter
    // currently yields 'C' rather than 'CM'. These tests pin the actual
    // behaviour; see the note in the coverage PR about the intent mismatch.
    it('falls back to the community-member initial when there is no seller name', () => {
      component.ad.sellerProfileName = null;
      expect(component.sellerInitials).toBe('C');
    });

    it('falls back to the community-member initial when the seller name is blank', () => {
      component.ad.sellerProfileName = '   ';
      expect(component.sellerInitials).toBe('C');
    });
  });

  describe('outputs', () => {
    it('emits view with the ad', () => {
      const spy = jest.fn();
      component.view.subscribe(spy);
      component.view.emit(component.ad);
      expect(spy).toHaveBeenCalledWith(component.ad);
    });

    it('emits contact with the ad', () => {
      const spy = jest.fn();
      component.contact.subscribe(spy);
      component.contact.emit(component.ad);
      expect(spy).toHaveBeenCalledWith(component.ad);
    });
  });
});
