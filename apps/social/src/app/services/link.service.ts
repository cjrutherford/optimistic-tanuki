import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Link } from "../../entities/link.entity";
import { Repository, FindOneOptions, FindManyOptions } from "typeorm";
import { CreateLinkDto, UpdateLinkDto } from "@optimistic-tanuki/models";

@Injectable()
export class LinkService {
    constructor(@Inject(getRepositoryToken(Link)) private readonly linkRepo: Repository<Link>) {}

    async create(createLinkDto: CreateLinkDto): Promise<Link> {
        const link = await this.linkRepo.create(createLinkDto);
        return await this.linkRepo.save(link);
    }

    async findAll(options?: FindManyOptions<Link>): Promise<Link[]> {
        return await this.linkRepo.find(options);
    }

    async findOne(id: number, options?: FindOneOptions<Link>): Promise<Link> {
        return await this.linkRepo.findOne({ where: { id }, ...options });
    }

    async update(id: number, updateLinkDto: UpdateLinkDto): Promise<void> {
        await this.linkRepo.update(id, updateLinkDto);
    }

    async remove(id: number): Promise<void> {
        await this.linkRepo.delete(id);
    }
}