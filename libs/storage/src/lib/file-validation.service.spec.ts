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
      'video',
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
