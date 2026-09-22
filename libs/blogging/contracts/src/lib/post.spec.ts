import { validate } from 'class-validator';
import { CreateBlogPostDto } from './post';

describe('CreateBlogPostDto', () => {
  it('accepts a selected blog catalog selector through whitelist validation', async () => {
    const dto = Object.assign(new CreateBlogPostDto(), {
      title: 'Catalog post',
      content: 'This post belongs to the selected catalog.',
      authorId: '11111111-1111-4111-8111-111111111111',
      selectedCatalogId: '22222222-2222-4222-8222-222222222222',
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true })
    ).resolves.toHaveLength(0);
  });
});
