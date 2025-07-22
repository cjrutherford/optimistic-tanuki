import { CreateRiskDto, UpdateRiskDto } from '@optimistic-tanuki/models';

import { Injectable } from '@nestjs/common';

@Injectable()
export class RiskService {
  create(createRiskDto: CreateRiskDto) {
    return 'This action adds a new risk';
  }

  findAll() {
    return `This action returns all risk`;
  }

  findOne(id: number) {
    return `This action returns a #${id} risk`;
  }

  update(id: number, updateRiskDto: UpdateRiskDto) {
    return `This action updates a #${id} risk`;
  }

  remove(id: number) {
    return `This action removes a #${id} risk`;
  }
}
