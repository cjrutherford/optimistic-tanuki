import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Post } from "../../entities/post.entity";
import { Repository, FindOneOptions, FindManyOptions } from "typeorm";
import { CreatePostDto, UpdatePostDto } from "@optimistic-tanuki/models";

/**
 * Service for managing posts.
 */
@Injectable()
export class PostService {
    /**
     * Creates an instance of PostService.
     * @param postRepo The repository for Post entities.
     */
    constructor(@Inject(getRepositoryToken(Post)) private readonly postRepo: Repository<Post>) {}

    /**
     * Creates a new post.
     * @param createPostDto The data for creating the post.
     * @returns A Promise that resolves to the created Post.
     */
    async create(createPostDto: CreatePostDto): Promise<Post> {
        const post = await this.postRepo.create(createPostDto);
        return await this.postRepo.save(post);
    }

    /**
     * Finds all posts based on provided options.
     * @param options Optional find many options.
     * @returns A Promise that resolves to an array of Post entities.
     */
    async findAll(options?: FindManyOptions<Post>): Promise<Post[]> {
        return await this.postRepo.find(options);
    }

    /**
     * Finds a single post by its ID and options.
     * @param id The ID of the post to find.
     * @param options Optional find one options.
     * @returns A Promise that resolves to the found Post entity.
     */
    async findOne(id: string, options?: FindOneOptions<Post>): Promise<Post> {
        return await this.postRepo.findOne({ where: { id }, ...options});
    }

    /**
     * Updates an existing post.
     * @param id The ID of the post to update.
     * @param updatePostDto The data for updating the post.
     * @returns A Promise that resolves when the post is updated.
     */
    async update(id: number, updatePostDto: UpdatePostDto): Promise<void> {
        await this.postRepo.update(id, updatePostDto);
    }

    /**
     * Removes a post by its ID.
     * @param id The ID of the post to remove.
     * @returns A Promise that resolves when the post is removed.
     */
    async remove(id: number): Promise<void> {
        await this.postRepo.delete(id);
    }
}