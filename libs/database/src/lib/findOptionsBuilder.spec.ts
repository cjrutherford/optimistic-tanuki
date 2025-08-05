import { FindOptionsBuilder } from './findOptionsBuilder';
import { FindOptionsOrder } from 'typeorm';

describe('FindOptionsBuilder', () => {
  let builder: FindOptionsBuilder<any>;

  beforeEach(() => {
    builder = new FindOptionsBuilder<any>();
  });

  it('should set where conditions', () => {
    const condition = { id: 1, name: 'test' };
    builder.where(condition);
    expect(builder.buildFindOneOptions().where).toEqual(condition);
    expect(builder.buildFindManyOptions().where).toEqual(condition);
  });

  it('should set relations', () => {
    const relations = ['user', 'comments'];
    builder.relations(relations);
    expect(builder.buildFindOneOptions().relations).toEqual(relations);
    expect(builder.buildFindManyOptions().relations).toEqual(relations);
  });

  it('should set order by conditions', () => {
    const order: { [key: string]: 'ASC' | 'DESC' } = { createdAt: 'DESC' };
    builder.order(order);
    expect(builder.buildFindOneOptions().order).toEqual(order);
    expect(builder.buildFindManyOptions().order).toEqual(order);
  });

  it('should set skip option for findMany', () => {
    const skip = 10;
    builder.skip(skip);
    expect(builder.buildFindManyOptions().skip).toEqual(skip);
  });

  it('should set take option for findMany', () => {
    const take = 5;
    builder.take(take);
    expect(builder.buildFindManyOptions().take).toEqual(take);
  });

  it('should build findOne options correctly', () => {
    const options = builder
      .where({ id: 1 })
      .relations(['profile'])
      .order({ name: 'ASC' } as { [key: string]: 'ASC' | 'DESC' })
      .buildFindOneOptions();

    expect(options).toEqual({
      where: { id: 1 },
      relations: ['profile'],
      order: { name: 'ASC' },
    });
  });

  it('should build findMany options correctly', () => {
    const options = builder
      .where({ status: 'active' })
      .relations(['items'])
      .order({ date: 'DESC' } as { [key: string]: 'ASC' | 'DESC' })
      .skip(5)
      .take(10)
      .buildFindManyOptions();

    expect(options).toEqual({
      where: { status: 'active' },
      relations: ['items'],
      order: { date: 'DESC' },
      skip: 5,
      take: 10,
    });
  });

  it('should return empty options if no methods are called', () => {
    expect(builder.buildFindOneOptions()).toEqual({});
    expect(builder.buildFindManyOptions()).toEqual({});
  });
});
