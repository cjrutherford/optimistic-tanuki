import { Module } from '@nestjs/common';
import { QuarantineService } from './quarantine.service';

@Module({
  providers: [QuarantineService],
  exports: [QuarantineService],
})
export class QuarantineModule {}
