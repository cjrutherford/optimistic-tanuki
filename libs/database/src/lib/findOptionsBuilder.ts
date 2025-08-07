import { FindOneOptions, FindManyOptions, FindOptionsWhere, FindOptionsOrder } from 'typeorm';

/**
 * A builder class for constructing TypeORM FindOptions.
 * @template T The entity type.
 */
export class FindOptionsBuilder<T> {
    private findOneOptions: FindOneOptions<T> = {};
    private findManyOptions: FindManyOptions<T> = {};

    /**
     * Sets the WHERE condition for the query.
     * @param condition A partial object representing the WHERE clause.
     * @returns The current FindOptionsBuilder instance.
     */
    where(condition: Partial<T>): this {
        this.findOneOptions.where = condition as FindOptionsWhere<T>;
        this.findManyOptions.where = condition as FindOptionsWhere<T>;
        return this;
    }

    /**
     * Specifies relations to be loaded with the entity.
     * @param relations An array of relation names.
     * @returns The current FindOptionsBuilder instance.
     */
    relations(relations: string[]): this {
        this.findOneOptions.relations = relations;
        this.findManyOptions.relations = relations;
        return this;
    }

    /**
     * Specifies the order in which results should be returned.
     * @param order An object specifying the order by properties.
     * @returns The current FindOptionsBuilder instance.
     */
    order(order: { [P in keyof T]?: 'ASC' | 'DESC' }): this {
        this.findOneOptions.order = order as FindOptionsOrder<T>;
        this.findManyOptions.order = order as FindOptionsOrder<T>;
        return this;
    }

    /**
     * Specifies the number of entities to skip.
     * @param skip The number of entities to skip.
     * @returns The current FindOptionsBuilder instance.
     */
    skip(skip: number): this {
        this.findManyOptions.skip = skip;
        return this;
    }

    /**
     * Specifies the maximum number of entities to return.
     * @param take The maximum number of entities to return.
     * @returns The current FindOptionsBuilder instance.
     */
    take(take: number): this {
        this.findManyOptions.take = take;
        return this;
    }

    /**
     * Builds and returns the FindOneOptions object.
     * @returns The constructed FindOneOptions.
     */
    buildFindOneOptions(): FindOneOptions<T> {
        return this.findOneOptions;
    }

    /**
     * Builds and returns the FindManyOptions object.
     * @returns The constructed FindManyOptions.
     */
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