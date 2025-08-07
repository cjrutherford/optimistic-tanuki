import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Attachment, AttachmentType } from "../../entities/attachment.entity";
import { Repository, FindOneOptions, FindManyOptions } from "typeorm";
import { CreateAttachmentDto, UpdateAttachmentDto } from "@optimistic-tanuki/models";
import { Post } from "../../entities/post.entity";

@Injectable()
/**
 * Service for managing attachments.
 */
@Injectable()
export class AttachmentService {
    /**
     * Creates an instance of AttachmentService.
     * @param attachmentRepo The repository for Attachment entities.
     */
    constructor(@Inject(getRepositoryToken(Attachment)) private readonly attachmentRepo: Repository<Attachment>) {}

    /**
     * Creates a new attachment.
     * @param createAttachmentDto The data for creating the attachment.
     * @param post The associated post entity.
     * @returns A Promise that resolves to the created Attachment.
     */
    async create(createAttachmentDto: CreateAttachmentDto, post: Post): Promise<Attachment> {
        const { url, type } = createAttachmentDto;
        const att: Partial<Attachment> = {
            post, filePath: url, type: (type as AttachmentType),
        }
        const attachment = await this.attachmentRepo.create(att);
        return await this.attachmentRepo.save(attachment);
    }

    /**
     * Finds all attachments based on provided options.
     * @param options Optional find many options.
     * @returns A Promise that resolves to an array of Attachment entities.
     */
    async findAll(options?: FindManyOptions<Attachment>): Promise<Attachment[]> {
        return await this.attachmentRepo.find(options);
    }

    /**
     * Finds a single attachment by its ID and options.
     * @param id The ID of the attachment to find.
     * @param options Optional find one options.
     * @returns A Promise that resolves to the found Attachment entity.
     */
    async findOne(id: string, options?: FindOneOptions<Attachment>): Promise<Attachment> {
        return await this.attachmentRepo.findOne({ where: { id }, ...options });
    }

    /**
     * Updates an existing attachment.
     * @param id The ID of the attachment to update.
     * @param updateAttachmentDto The data for updating the attachment.
     * @returns A Promise that resolves when the attachment is updated.
     */
    async update(id: string, updateAttachmentDto: UpdateAttachmentDto): Promise<void> {
        const { url } = updateAttachmentDto;
        await this.attachmentRepo.update(id, { filePath: url });
    }

    /**
     * Removes an attachment by its ID.
     * @param id The ID of the attachment to remove.
     * @returns A Promise that resolves when the attachment is removed.
     */
    async remove(id: string): Promise<void> {
        await this.attachmentRepo.delete(id);
    }
}