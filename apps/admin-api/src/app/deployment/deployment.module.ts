import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';

@Module({
  imports: [ConfigModule],
  controllers: [DeploymentController],
  providers: [DeploymentService],
  exports: [DeploymentService],
})
export class DeploymentModule {}
