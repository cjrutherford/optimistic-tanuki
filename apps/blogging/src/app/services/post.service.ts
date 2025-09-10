import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Post } from "../entities";
import { FindOptionsWhere, Repository, Like, Between } from "typeorm";
import { 
    CreateBlogPostDto, 
    UpdateBlogPostDto, 
    BlogPostQueryDto, 
    BlogPostDto
} from '@optimistic-tanuki/models'

@Injectable()
export class PostService {
    constructor(
        @Inject(getRepositoryToken(Post)) private readonly postRepository: Repository<Post>,
    ) {
        console.log('PostService initialized');
    }
    
    async create(createPostDto: CreateBlogPostDto): Promise<BlogPostDto> {
        const post = this.postRepository.create(createPostDto);
        return this.postRepository.save(post);
    }

    async findAll(query: BlogPostQueryDto): Promise<BlogPostDto[]> {
        const where: FindOptionsWhere<Post> = {};
        if (query.title) {
            where.title = query.title;
        }
        if (query.authorId) {
            where.authorId = query.authorId;
        }
        if (query.content !== undefined) {
            where.content = Like(`%${query.content}%`);
        }
        if(query.createdAt && query.createdAt.length == 2) {
            where.createdAt = Between(new Date(query.createdAt[0]), new Date(query.createdAt[1]));
        }
        if(query.updatedAt && query.updatedAt.length == 2) {
            where.updatedAt = Between(new Date(query.updatedAt[0]), new Date(query.updatedAt[1]));
        }
        return this.postRepository.find({ where });
    }

    async findOne(id: string): Promise<BlogPostDto> {
        return await this.postRepository.findOne({ where: { id } });
    }

    async update(id: string, updatePostDto: UpdateBlogPostDto): Promise<BlogPostDto> {
        await this.postRepository.update(id, updatePostDto);
        return await this.postRepository.findOne({ where: { id } });
    }

    async remove(id: string): Promise<void> {
        await this.postRepository.delete(id);
    }
}