import { Module } from '@nestjs/common';
import { ParseService } from './parse.service';
import { QuarantineModule } from '../quarantine/quarantine.module';

@Module({
  imports: [QuarantineModule],
  providers: [ParseService],
  exports: [ParseService],
})
export class ParseModule {}
