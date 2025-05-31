import { FindOneOptions, FindManyOptions, FindOptionsWhere, FindOptionsOrder } from 'typeorm';

export class FindOptionsBuilder<T> {
    private findOneOptions: FindOneOptions<T> = {};
    private findManyOptions: FindManyOptions<T> = {};

    where(condition: Partial<T>): this {
        this.findOneOptions.where = condition as FindOptionsWhere<T>;
        this.findManyOptions.where = condition as FindOptionsWhere<T>;
        return this;
    }

    relations(relations: string[]): this {
        this.findOneOptions.relations = relations;
        this.findManyOptions.relations = relations;
        return this;
    }

    order(order: { [P in keyof T]?: 'ASC' | 'DESC' }): this {
        this.findOneOptions.order = order as FindOptionsOrder<T>;
        this.findManyOptions.order = order as FindOptionsOrder<T>;
        return this;
    }

    skip(skip: number): this {
        this.findManyOptions.skip = skip;
        return this;
    }

    take(take: number): this {
        this.findManyOptions.take = take;
        return this;
    }

    buildFindOneOptions(): FindOneOptions<T> {
        return this.findOneOptions;
    }

    buildFindManyOptions(): FindManyOptions<T> {
        return this.findManyOptions;
    }
};

// Usage example:
// const options = new QueryOptionsBuilder<Goal>()
//     .where({ id: 1 })
//     .relations(['related_project'])
//     .order({ created_at: 'DESC' })
//     .buildFindOneOptions();