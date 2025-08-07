import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Comment } from "../../entities/comment.entity";
import { Repository, FindOneOptions, FindManyOptions } from "typeorm";
import { CreateCommentDto, UpdateCommentDto } from "@optimistic-tanuki/models";
import { RpcException } from "@nestjs/microservices";
import { Post } from "../../entities/post.entity";

@Injectable()
/**
 * Service for managing comments.
 */
@Injectable()
export class CommentService {
    /**
     * Creates an instance of CommentService.
     * @param commentRepo The repository for Comment entities.
     * @param postRepo The repository for Post entities.
     */
    constructor(
        @Inject(getRepositoryToken(Comment)) private readonly commentRepo: Repository<Comment>,
        @Inject(getRepositoryToken(Post)) private readonly postRepo: Repository<Post>,
    ) {}

    /**
     * Creates a new comment.
     * @param createCommentDto The data for creating the comment.
     * @returns A Promise that resolves to the created Comment.
     * @throws RpcException if the post is not found or if comment creation fails.
     */
    async create(createCommentDto: CreateCommentDto): Promise<Comment> {
        console.log('Creating comment');
        try {
            console.log('finding post')
            const post = await this.postRepo.findOne({ where: { id: createCommentDto.postId } }); // njsscan-ignore: node_nosqli_injection
            if (!post) {
                console.log('post not found')
                throw new RpcException('Post not found');
            }
            console.log('post found', post)
            const commentToCreate: Partial<Comment> = {
                ...createCommentDto,
                post,
            };
            const comment = await this.commentRepo.create(commentToCreate);
            return await this.commentRepo.save(comment);
        } catch (error) {
            throw new RpcException(error.message);
        }
    }

    /**
     * Finds all comments based on provided options.
     * @param options Optional find many options.
     * @returns A Promise that resolves to an array of Comment entities.
     */
    async findAll(options?: FindManyOptions<Comment>): Promise<Comment[]> {
        return await this.commentRepo.find(options);
    }

    /**
     * Finds a single comment by its ID and options.
     * @param id The ID of the comment to find.
     * @param options Optional find one options.
     * @returns A Promise that resolves to the found Comment entity.
     */
    async findOne(id: string, options?: FindOneOptions<Comment>): Promise<Comment> {
        return await this.commentRepo.findOne({ where: { id }, ...options });
    }

    /**
     * Updates an existing comment.
     * @param id The ID of the comment to update.
     * @param updateCommentDto The data for updating the comment.
     * @returns A Promise that resolves when the comment is updated.
     */
    async update(id: string, updateCommentDto: UpdateCommentDto): Promise<void> {
        await this.commentRepo.update(id, updateCommentDto);
    }

    /**
     * Removes a comment by its ID.
     * @param id The ID of the comment to remove.
     * @returns A Promise that resolves when the comment is removed.
     */
    async remove(id: string): Promise<void> {
        await this.commentRepo.delete(id);
    }
}