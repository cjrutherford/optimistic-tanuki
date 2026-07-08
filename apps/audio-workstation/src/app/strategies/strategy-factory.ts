import { Injectable } from '@nestjs/common';
import { CollaborationStrategy } from './collaboration-strategy.interface';
import { FullAutoStrategy } from './full-auto.strategy';
import { CoverStrategy } from './cover.strategy';
import { FullCollabStrategy } from './full-collab.strategy';
import { CollaborationMode } from '@optimistic-tanuki/constants';

@Injectable()
export class StrategyFactory {
  constructor(
    private readonly fullAuto: FullAutoStrategy,
    private readonly cover: CoverStrategy,
    private readonly fullCollab: FullCollabStrategy
  ) {}

  getStrategy(mode: string): CollaborationStrategy {
    switch (mode) {
      case CollaborationMode.FULL_AUTO:
        return this.fullAuto;
      case CollaborationMode.COVER:
        return this.cover;
      case CollaborationMode.FULL_COLLAB:
        return this.fullCollab;
      default:
        return this.fullAuto;
    }
  }
}
