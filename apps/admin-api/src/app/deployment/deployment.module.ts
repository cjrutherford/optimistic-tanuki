import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { AdminApiAuthModule } from '../auth/admin-api-auth.module';

@Module({
  imports: [ConfigModule, AdminApiAuthModule],
  controllers: [DeploymentController],
  providers: [DeploymentService],
  exports: [DeploymentService],
})
export class DeploymentModule {}
