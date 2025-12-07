import { Inject, Injectable } from "@nestjs/common";
import { Contact } from "../entities";
import { Between, Like, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";

import {
    ContactDto, CreateContactDto, UpdateContactDto, ContactQueryDto
} from "@optimistic-tanuki/models"

@Injectable()
export class ContactService {
    constructor(
        @Inject(getRepositoryToken(Contact)) private readonly contactRepository: Repository<Contact>,
    ) {
        console.log('ContactService initialized');
    }

    async create(createContactDto: CreateContactDto): Promise<ContactDto> {
        const contact = this.contactRepository.create(createContactDto);
        return await this.contactRepository.save(contact);
    }

    async findAll(query: ContactQueryDto): Promise<ContactDto[]> {
        const where: any = {};
        if (query.name) {
            where.name = query.name;
        }
        if (query.message) {
            where.message = Like(`%${query.message}%`);
        }
        if (query.email) {
            where.email = Like(`%${query.email}%`);
        }
        if (query.phone) {
            where.phone = Like(`%${query.phone}%`);
        }
        if(query.createdAt && query.createdAt.length == 2) {
            where.createdAt = Between(new Date(query.createdAt[0]), new Date(query.createdAt[1]));
        }
        if(query.updatedAt && query.updatedAt.length == 2) {
            where.updatedAt = Between(new Date(query.updatedAt[0]), new Date(query.updatedAt[1]));
        }
        return await this.contactRepository.find({ where });
    }

    async findOne(id: string): Promise<ContactDto> {
        return await this.contactRepository.findOne({ where: { id } });
    }

    async update(id: string, updateContactDto: UpdateContactDto): Promise<ContactDto> {
        await this.contactRepository.update(id, updateContactDto);
        return await this.contactRepository.findOne({ where: { id } });
    }

    async remove(id: string): Promise<void> {
        await this.contactRepository.delete(id);
    }
}
