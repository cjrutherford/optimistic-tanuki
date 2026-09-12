import { validate } from 'class-validator';
import { CreateProductDto } from './product.dto';

describe('CreateProductDto', () => {
  it('accepts the minimal Store authoring payload without a description', async () => {
    const dto = Object.assign(new CreateProductDto(), {
      name: 'R6 Scope Offer',
      priceCents: 12500,
      type: 'physical',
      catalogId: '479e4780-48ed-4248-bba8-dd4457108b09',
    });

    expect(await validate(dto)).toEqual([]);
  });
});
