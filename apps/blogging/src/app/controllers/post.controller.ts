import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { BlogPostCommands } from "@optimistic-tanuki/constants";
import { PostService } from "../services";
import { CreateBlogPostDto, BlogPostDto, BlogPostQueryDto, UpdateBlogPostDto } from "@optimistic-tanuki/models";

@Controller('post')
export class PostController {
    constructor(private readonly postService: PostService) {
        console.log('PostController initialized');
    }

    @MessagePattern({ cmd: BlogPostCommands.CREATE })
    async createPost(@Payload() createPostDto: CreateBlogPostDto): Promise<BlogPostDto> {
        return await this.postService.create(createPostDto);
    }

    @MessagePattern({ cmd: BlogPostCommands.FIND_ALL })
    async findAllPosts(@Payload() query: BlogPostQueryDto): Promise<BlogPostDto[]> {
        return await this.postService.findAll(query);
    }

    @MessagePattern({ cmd: BlogPostCommands.FIND })
    async findOnePost(@Payload() id: string): Promise<BlogPostDto> {
        return await this.postService.findOne(id);
    }

    @MessagePattern({ cmd: BlogPostCommands.UPDATE })
    async updatePost(@Payload() data: { id: string, updatePostDto: UpdateBlogPostDto, requestingAuthorId?: string }): Promise<BlogPostDto> {
        return await this.postService.update(data.id, data.updatePostDto, data.requestingAuthorId);
    }

    @MessagePattern({ cmd: BlogPostCommands.DELETE })
    async deletePost(@Payload() id: string): Promise<void> {
        return await this.postService.remove(id);
    }

    @MessagePattern({ cmd: BlogPostCommands.FIND_PUBLISHED })
    async findPublishedPosts(): Promise<BlogPostDto[]> {
        return await this.postService.findPublished();
    }

    @MessagePattern({ cmd: BlogPostCommands.FIND_DRAFTS_BY_AUTHOR })
    async findDraftsByAuthor(@Payload() authorId: string): Promise<BlogPostDto[]> {
        return await this.postService.findDraftsByAuthor(authorId);
    }

    @MessagePattern({ cmd: BlogPostCommands.PUBLISH })
    async publishPost(@Payload() data: { id: string, requestingAuthorId: string }): Promise<BlogPostDto> {
        return await this.postService.publish(data.id, data.requestingAuthorId);
    }
}