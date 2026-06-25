import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BootstrapController } from './bootstrap.controller';
import { BootstrapService } from './bootstrap.service';

@Module({
  imports: [ConfigModule],
  controllers: [BootstrapController],
  providers: [BootstrapService],
  exports: [BootstrapService],
})
export class BootstrapModule {}
