import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Blog } from "../entities";
import { Between, FindOptionsWhere, Like, Repository } from "typeorm";
import { 
    CreateBlogDto, 
    UpdateBlogDto, 
    BlogQueryDto, 
    BlogDto
} from '@optimistic-tanuki/models'

@Injectable()
export class BlogService {
    constructor(
        @Inject(getRepositoryToken(Blog)) private readonly blogRepository: Repository<Blog>,
    ) {
        console.log('BlogService initialized');
    }
    
    async create(createBlogDto: CreateBlogDto): Promise<BlogDto> {
        const blog = this.blogRepository.create(createBlogDto);
        return this.blogRepository.save(blog);
    }

    async findAll(query: BlogQueryDto): Promise<BlogDto[]> {
        const where: FindOptionsWhere<Blog> = {};
        if (query.name) {
            where.name = Like(`%${query.name}%`);
        }
        if (query.description) {
            where.description = Like(`%${query.description}%`);
        }
        if (query.ownerId) {
            where.ownerId = query.ownerId;
        }
        if(query.createdAt && query.createdAt.length == 2) {
            where.createdAt = Between(new Date(query.createdAt[0]), new Date(query.createdAt[1]));
        }
        if(query.updatedAt && query.updatedAt.length == 2) {
            where.updatedAt = Between(new Date(query.updatedAt[0]), new Date(query.updatedAt[1]));
        }
        return this.blogRepository.find({ where });
    }

    async findOne(id: string): Promise<BlogDto> {
        return await this.blogRepository.findOne({ where: { id } });
    }

    async update(id: string, updateBlogDto: UpdateBlogDto): Promise<BlogDto> {
        await this.blogRepository.update(id, updateBlogDto);
        return await this.blogRepository.findOne({ where: { id } });
    }

    async remove(id: string): Promise<void> {
        await this.blogRepository.delete(id);
    }
}
