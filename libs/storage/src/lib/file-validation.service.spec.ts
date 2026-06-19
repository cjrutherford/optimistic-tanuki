import { FileValidationService } from './file-validation.service';

describe('FileValidationService', () => {
  let service: FileValidationService;

  beforeEach(() => {
    service = new FileValidationService();
  });

  it('accepts video uploads larger than the previous max size limit', () => {
    const result = service.validateFile(
      'feature-film.mp4',
      'video/mp4',
      20 * 1024 * 1024 * 1024,
      'video'
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
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
