import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Any, FindOptionsWhere, Like, Repository } from 'typeorm';
import { PersonaTelos } from '../entities';
import { CreatePersonaTelosDto, PersonaTelosDto, QueryPersonaTelsosDto, UpdatePersonaTelosDto } from '@optimistic-tanuki/models';

@Injectable()
export class PersonaTelosService {

    constructor(
        @Inject(getRepositoryToken(PersonaTelos))
        private readonly personaRepository: Repository<PersonaTelos>,
    ) {}

    async create(data: CreatePersonaTelosDto) {
        const persona = this.personaRepository.create(data);
        return await this.personaRepository.save(persona);
    }

    async findAll(query: QueryPersonaTelsosDto): Promise<PersonaTelosDto[]> {
        const where: FindOptionsWhere<PersonaTelos> = {};

        if (query.name) {
            where.name = query.name;
        }
        if (query.description) {
            where.description = query.description;
        }
        if(query.goals) {
            where.goals = Any(query.goals);
        }
        if(query.skills) {
            where.skills = Any(query.skills);
        }

        if(query.interests) {
            where.interests = Any(query.interests);
        }

        if(query.limitations) {
            where.limitations = Any(query.limitations);
        }

        if(query.strengths) {
            where.strengths = Any(query.strengths);
        }

        if(query.objectives) {
            where.objectives = Any(query.objectives);
        }

        if(query.coreObjective) {
            where.coreObjective = Like(`%${query.coreObjective}%`);
        }

        return await this.personaRepository.find({ where });
    }

    async findOne(id: string): Promise<PersonaTelosDto | null> {
        return await this.personaRepository.findOne({ where: { id } });
    }

    async update(id: string, data: UpdatePersonaTelosDto): Promise<PersonaTelos | null> {
        await this.personaRepository.update(id, data);
        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        await this.personaRepository.delete(id);
    }
}

