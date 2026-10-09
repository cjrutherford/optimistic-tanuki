import { CreatePostDto } from './createpost.dto';
import { PostDto } from './post.dto';
import { validate } from 'class-validator';

describe('Post response contract', () => {
  it('documents explicit public audience on responses only', () => {
    const responseSchema = Reflect.getMetadata(
      'swagger/apiModelProperties',
      PostDto.prototype,
      'publicAudienceExplicit'
    );
    const createSchema = Reflect.getMetadata(
      'swagger/apiModelProperties',
      CreatePostDto.prototype,
      'publicAudienceExplicit'
    );

    expect(responseSchema).toMatchObject({
      type: Boolean,
      default: false,
      description: expect.any(String),
    });
    expect(createSchema).toBeUndefined();
  });

  it('validates the response marker as a boolean', async () => {
    const dto = Object.assign(new PostDto(), {
      publicAudienceExplicit: 'true',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(
      'publicAudienceExplicit'
    );
  });
});
