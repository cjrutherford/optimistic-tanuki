import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateChannelDto,
  UpdateChannelDto,
} from '@optimistic-tanuki/models';
import { Channel } from '../../entities/channel.entity';

@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>
  ) {}

  async create(createChannelDto: CreateChannelDto): Promise<Channel> {
    const channel = this.channelRepository.create(createChannelDto);
    return this.channelRepository.save(channel);
  }

  async findAll(): Promise<Channel[]> {
    return this.channelRepository.find({ relations: ['videos', 'subscriptions'] });
  }

  async findOne(id: string): Promise<Channel> {
    return this.channelRepository.findOne({
      where: { id },
      relations: ['videos', 'subscriptions'],
    });
  }

  async findByUser(userId: string): Promise<Channel[]> {
    return this.channelRepository.find({
      where: { userId },
      relations: ['videos', 'subscriptions'],
    });
  }

  async update(
    id: string,
    updateChannelDto: UpdateChannelDto
  ): Promise<Channel> {
    const channel = await this.findOne(id);
    if (!channel) {
      throw new Error(`Channel with ID ${id} not found`);
    }
    await this.channelRepository.update(id, {
      ...updateChannelDto,
      updatedAt: new Date(),
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.channelRepository.delete(id);
  }
}
