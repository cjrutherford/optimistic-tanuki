import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Attachment, AttachmentType } from "../../entities/attachment.entity";
import { Repository, FindOneOptions, FindManyOptions } from "typeorm";
import { CreateAttachmentDto, UpdateAttachmentDto } from "@optimistic-tanuki/models";
import { Post } from "../../entities/post.entity";

@Injectable()
export class AttachmentService {
    constructor(@Inject(getRepositoryToken(Attachment)) private readonly attachmentRepo: Repository<Attachment>) {}

    async create(createAttachmentDto: CreateAttachmentDto, post: Post): Promise<Attachment> {
        const { url, type } = createAttachmentDto;
        const att: Partial<Attachment> = {
            post, filePath: url, type: (type as AttachmentType),
        }
        const attachment = await this.attachmentRepo.create(att);
        return await this.attachmentRepo.save(attachment);
    }

    async findAll(options?: FindManyOptions<Attachment>): Promise<Attachment[]> {
        return await this.attachmentRepo.find(options);
    }

    async findOne(id: string, options?: FindOneOptions<Attachment>): Promise<Attachment> {
        return await this.attachmentRepo.findOne({ where: { id }, ...options });
    }

    async update(id: string, updateAttachmentDto: UpdateAttachmentDto): Promise<void> {
        const { url } = updateAttachmentDto;
        await this.attachmentRepo.update(id, { filePath: url });
    }

    async remove(id: string): Promise<void> {
        await this.attachmentRepo.delete(id);
    }
}