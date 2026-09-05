import { ClassifiedFormComponent } from './classified-form.component';
import { ClassifiedAdDto } from '../models/index';

describe('ClassifiedFormComponent', () => {
  let component: ClassifiedFormComponent;

  const existingAd: ClassifiedAdDto = {
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
    imageUrls: ['https://example.com/a.png'],
    status: 'active',
    isFeatured: false,
    featuredUntil: null,
    appScope: 'classifieds',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
  };

  function makeFile(name = 'photo.png'): File {
    return new File(['content'], name, { type: 'image/png' });
  }

  function fileInputEvent(files: File[]): Event {
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', {
      value: files,
      writable: false,
    });
    return { target: input } as unknown as Event;
  }

  beforeEach(() => {
    component = new ClassifiedFormComponent();
    component.communityId = 'community-1';
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('isEdit', () => {
    it('is false when there is no existing ad', () => {
      expect(component.isEdit).toBe(false);
    });

    it('is true when an existing ad is provided', () => {
      component.existingAd = existingAd;
      expect(component.isEdit).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    it('sets the community id on a fresh form', () => {
      component.ngOnInit();
      expect(component.formData.communityId).toBe('community-1');
    });

    it('populates form data from an existing ad', () => {
      component.existingAd = existingAd;
      component.ngOnInit();

      expect(component.formData).toEqual({
        communityId: 'community-1',
        title: 'Bike',
        description: 'A nice bike',
        price: 100,
        currency: 'USD',
        category: 'Sports',
        condition: 'Good',
        imageUrls: ['https://example.com/a.png'],
      });
      expect(component.imagePreviews()).toEqual(['https://example.com/a.png']);
    });

    it('defaults category/condition to empty strings when absent on the existing ad', () => {
      component.existingAd = {
        ...existingAd,
        category: null,
        condition: null,
        imageUrls: null,
      };
      component.ngOnInit();

      expect(component.formData.category).toBe('');
      expect(component.formData.condition).toBe('');
      expect(component.formData.imageUrls).toEqual([]);
    });
  });

  describe('onSubmit', () => {
    it('rejects a blank title', () => {
      component.formData.title = '   ';
      component.formData.description = 'desc';
      const spy = jest.fn();
      component.submitForm.subscribe(spy);

      component.onSubmit();

      expect(component.error()).toBe('Title is required.');
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects a blank description', () => {
      component.formData.title = 'Title';
      component.formData.description = '   ';

      component.onSubmit();

      expect(component.error()).toBe('Description is required.');
    });

    it('rejects a negative price', () => {
      component.formData.title = 'Title';
      component.formData.description = 'desc';
      component.formData.price = -5;

      component.onSubmit();

      expect(component.error()).toBe('Price must be 0 or greater.');
    });

    it('emits the payload and resets submitting state on success', () => {
      component.formData = {
        communityId: 'community-1',
        title: 'Title',
        description: 'desc',
        price: 10,
        currency: 'USD',
        category: '',
        condition: '',
        imageUrls: [],
      };
      const spy = jest.fn();
      component.submitForm.subscribe(spy);

      component.onSubmit();

      expect(component.error()).toBeNull();
      expect(component.submitting()).toBe(false);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Title',
          description: 'desc',
          price: 10,
          category: undefined,
          condition: undefined,
        })
      );
    });
  });

  describe('removeImage', () => {
    it('removes the preview and matching image url at the given index', () => {
      component.imagePreviews.set(['a', 'b', 'c']);
      component.formData.imageUrls = ['a', 'b', 'c'];

      component.removeImage(1);

      expect(component.imagePreviews()).toEqual(['a', 'c']);
      expect(component.formData.imageUrls).toEqual(['a', 'c']);
    });

    it('handles removal when imageUrls is undefined', () => {
      component.imagePreviews.set(['a']);
      component.formData.imageUrls = undefined;

      expect(() => component.removeImage(0)).not.toThrow();
      expect(component.imagePreviews()).toEqual([]);
    });
  });

  describe('onFilesSelected', () => {
    it('does nothing when no files are selected', async () => {
      const event = fileInputEvent([]);
      await component.onFilesSelected(event);
      expect(component.imagePreviews()).toEqual([]);
    });

    it('stores data-url previews directly when no uploadImage callback is provided', async () => {
      const event = fileInputEvent([makeFile()]);

      await component.onFilesSelected(event);

      expect(component.imagePreviews()).toHaveLength(1);
      expect(component.formData.imageUrls).toHaveLength(1);
      expect(component.formData.imageUrls?.[0]).toContain('data:');
    });

    it('uploads files via the provided callback and stores the returned urls', async () => {
      component.uploadImage = jest
        .fn()
        .mockResolvedValue('https://example.com/uploaded.png');
      const event = fileInputEvent([makeFile()]);

      await component.onFilesSelected(event);

      expect(component.uploadImage).toHaveBeenCalled();
      expect(component.formData.imageUrls).toEqual([
        'https://example.com/uploaded.png',
      ]);
      expect(component.imageUploading()).toBe(false);
      expect(component.error()).toBeNull();
    });

    it('records an error and rolls back previews for files that fail to upload', async () => {
      component.uploadImage = jest
        .fn()
        .mockRejectedValue(new Error('upload failed'));
      const event = fileInputEvent([makeFile('bad.png')]);

      await component.onFilesSelected(event);

      expect(component.error()).toContain('Failed to upload: bad.png');
      expect(component.formData.imageUrls ?? []).toHaveLength(0);
      expect(component.imageUploading()).toBe(false);
    });

    it('caps the number of new files at the remaining slots (max 5 total)', async () => {
      component.formData.imageUrls = ['1', '2', '3', '4'];
      const files = [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')];
      const event = fileInputEvent(files);

      await component.onFilesSelected(event);

      expect(component.formData.imageUrls).toHaveLength(5);
    });
  });
});
