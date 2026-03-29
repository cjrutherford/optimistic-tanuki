import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Lead,
  CreateLeadDto,
  UpdateLeadDto,
  LeadStats,
  LeadStatus,
} from '@optimistic-tanuki/models';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>
  ) {}

  async findAll(filters?: {
    status?: string;
    source?: string;
  }): Promise<Lead[]> {
    const query = this.leadRepository.createQueryBuilder('lead');

    if (filters?.status) {
      query.andWhere('lead.status = :status', { status: filters.status });
    }
    if (filters?.source) {
      query.andWhere('lead.source = :source', { source: filters.source });
    }

    return query.orderBy('lead.nextFollowUp', 'ASC').getMany();
  }

  async findOne(id: string): Promise<Lead> {
    return this.leadRepository.findOneBy({ id });
  }

  async create(dto: CreateLeadDto): Promise<Lead> {
    const lead = this.leadRepository.create(dto);
    return this.leadRepository.save(lead);
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    await this.leadRepository.update(id, dto);
    return this.leadRepository.findOneBy({ id });
  }

  async delete(id: string): Promise<void> {
    await this.leadRepository.delete(id);
  }

  async getStats(): Promise<LeadStats> {
    const leads = await this.leadRepository.find();

    return {
      total: leads.length,
      autoDiscovered: leads.filter((l) => l.isAutoDiscovered).length,
      manual: leads.filter((l) => !l.isAutoDiscovered).length,
      totalValue: leads.reduce((sum, l) => sum + (Number(l.value) || 0), 0),
      followUpsDue: leads.filter((l) => {
        if (!l.nextFollowUp) return false;
        if (l.status === LeadStatus.WON || l.status === LeadStatus.LOST)
          return false;
        return new Date(l.nextFollowUp) <= new Date();
      }).length,
      byStatus: leads.reduce((acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}
