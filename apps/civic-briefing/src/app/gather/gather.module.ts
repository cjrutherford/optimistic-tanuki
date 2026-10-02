import { Module } from '@nestjs/common';
import { GatherService } from './gather.service';
import { QuarantineModule } from '../quarantine/quarantine.module';

@Module({
  imports: [QuarantineModule],
  providers: [GatherService],
  exports: [GatherService],
})
export class GatherModule {}
