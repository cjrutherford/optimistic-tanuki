import { Inject, Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
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
        const postData = {
            ...createPostDto,
            isDraft: createPostDto.isDraft !== undefined ? createPostDto.isDraft : true,
            publishedAt: createPostDto.isDraft === false ? new Date() : null,
        };
        const post = this.postRepository.create(postData);
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
        if (query.isDraft !== undefined) {
            where.isDraft = query.isDraft;
        }
        if(query.createdAt && query.createdAt.length == 2) {
            where.createdAt = Between(new Date(query.createdAt[0]), new Date(query.createdAt[1]));
        }
        if(query.updatedAt && query.updatedAt.length == 2) {
            where.updatedAt = Between(new Date(query.updatedAt[0]), new Date(query.updatedAt[1]));
        }
        return this.postRepository.find({ where });
    }

    /**
     * Find published posts only (for public consumption)
     */
    async findPublished(): Promise<BlogPostDto[]> {
        return this.postRepository.find({ 
            where: { isDraft: false },
            order: { publishedAt: 'DESC' }
        });
    }

    /**
     * Find drafts for a specific author
     */
    async findDraftsByAuthor(authorId: string): Promise<BlogPostDto[]> {
        return this.postRepository.find({ 
            where: { authorId, isDraft: true },
            order: { updatedAt: 'DESC' }
        });
    }

    async findOne(id: string): Promise<BlogPostDto> {
        return await this.postRepository.findOne({ where: { id } });
    }

    /**
     * Update a post with ownership validation.
     * Only the original author can update the post.
     * @param id - Post ID
     * @param updatePostDto - Update data
     * @param requestingAuthorId - ID of the user making the request (required for ownership check)
     */
    async update(id: string, updatePostDto: UpdateBlogPostDto, requestingAuthorId: string): Promise<BlogPostDto> {
        const existingPost = await this.postRepository.findOne({ where: { id } });
        if (!existingPost) {
            throw new NotFoundException(`Post with id ${id} not found`);
        }
        
        // Enforce ownership check - only the author can edit their own posts
        if (existingPost.authorId !== requestingAuthorId) {
            throw new ForbiddenException('You can only edit your own posts');
        }

        // Handle publish transition
        const updateData: Partial<Post> = { ...updatePostDto };
        if (updatePostDto.isDraft === false && existingPost.isDraft === true) {
            // Publishing the post
            updateData.publishedAt = new Date();
        }
        
        await this.postRepository.update(id, updateData);
        return await this.postRepository.findOne({ where: { id } });
    }

    /**
     * Admin update without ownership check.
     * Use this for administrative operations only.
     * @param id - Post ID
     * @param updatePostDto - Update data
     */
    async adminUpdate(id: string, updatePostDto: UpdateBlogPostDto): Promise<BlogPostDto> {
        const existingPost = await this.postRepository.findOne({ where: { id } });
        if (!existingPost) {
            throw new NotFoundException(`Post with id ${id} not found`);
        }

        // Handle publish transition
        const updateData: Partial<Post> = { ...updatePostDto };
        if (updatePostDto.isDraft === false && existingPost.isDraft === true) {
            // Publishing the post
            updateData.publishedAt = new Date();
        }
        
        await this.postRepository.update(id, updateData);
        return await this.postRepository.findOne({ where: { id } });
    }

    /**
     * Publish a draft post (set isDraft to false and set publishedAt)
     */
    async publish(id: string, requestingAuthorId: string): Promise<BlogPostDto> {
        const existingPost = await this.postRepository.findOne({ where: { id } });
        if (!existingPost) {
            throw new NotFoundException(`Post with id ${id} not found`);
        }
        
        if (existingPost.authorId !== requestingAuthorId) {
            throw new ForbiddenException('You can only publish your own posts');
        }

        if (!existingPost.isDraft) {
            return existingPost; // Already published
        }

        await this.postRepository.update(id, {
            isDraft: false,
            publishedAt: new Date()
        });
        
        return await this.postRepository.findOne({ where: { id } });
    }

    async remove(id: string): Promise<void> {
        await this.postRepository.delete(id);
    }
}