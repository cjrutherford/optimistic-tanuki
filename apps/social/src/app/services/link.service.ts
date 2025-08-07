import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Link } from "../../entities/link.entity";
import { Repository, FindOneOptions, FindManyOptions } from "typeorm";
import { CreateLinkDto, UpdateLinkDto } from "@optimistic-tanuki/models";

@Injectable()
/**
 * Service for managing links.
 */
@Injectable()
export class LinkService {
    /**
     * Creates an instance of LinkService.
     * @param linkRepo The repository for Link entities.
     */
    constructor(@Inject(getRepositoryToken(Link)) private readonly linkRepo: Repository<Link>) {}

    /**
     * Creates a new link.
     * @param createLinkDto The data for creating the link.
     * @returns A Promise that resolves to the created Link.
     */
    async create(createLinkDto: CreateLinkDto): Promise<Link> {
        const link = await this.linkRepo.create(createLinkDto);
        return await this.linkRepo.save(link);
    }

    /**
     * Finds all links based on provided options.
     * @param options Optional find many options.
     * @returns A Promise that resolves to an array of Link entities.
     */
    async findAll(options?: FindManyOptions<Link>): Promise<Link[]> {
        return await this.linkRepo.find(options);
    }

    /**
     * Finds a single link by its ID and options.
     * @param id The ID of the link to find.
     * @param options Optional find one options.
     * @returns A Promise that resolves to the found Link entity.
     */
    async findOne(id: number, options?: FindOneOptions<Link>): Promise<Link> {
        return await this.linkRepo.findOne({ where: { id }, ...options });
    }

    /**
     * Updates an existing link.
     * @param id The ID of the link to update.
     * @param updateLinkDto The data for updating the link.
     * @returns A Promise that resolves when the link is updated.
     */
    async update(id: number, updateLinkDto: UpdateLinkDto): Promise<void> {
        await this.linkRepo.update(id, updateLinkDto);
    }

    /**
     * Removes a link by its ID.
     * @param id The ID of the link to remove.
     * @returns A Promise that resolves when the link is removed.
     */
    async remove(id: number): Promise<void> {
        await this.linkRepo.delete(id);
    }
}