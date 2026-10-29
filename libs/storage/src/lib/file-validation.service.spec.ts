import { FileValidationService } from './file-validation.service';

describe('FileValidationService', () => {
  let service: FileValidationService;

  beforeEach(() => {
    service = new FileValidationService();
  });

  it('accepts video uploads within the fail-closed scan limit', () => {
    const result = service.validateFile(
      'feature-film.mp4',
      'video/mp4',
      25 * 1024 * 1024,
      'video'
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects video uploads above the supported scanner limit', () => {
    const result = service.validateFile(
      'feature-film.mp4',
      'video/mp4',
      25 * 1024 * 1024 + 1,
      'video'
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('exceeds maximum allowed size of 25.00MB'),
      ])
    );
  });

  it('accepts image uploads up to 20MB', () => {
    const result = service.validateFile(
      'contact-photo.jpg',
      'image/jpeg',
      20 * 1024 * 1024,
      'image'
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects image uploads larger than 20MB', () => {
    const result = service.validateFile(
      'contact-photo.jpg',
      'image/jpeg',
      20 * 1024 * 1024 + 1,
      'image'
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('exceeds maximum allowed size of 20.00MB'),
      ])
    );
  });
});
