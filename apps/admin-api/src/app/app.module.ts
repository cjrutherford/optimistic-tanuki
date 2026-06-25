import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { DeploymentModule } from './deployment/deployment.module';
import { OAuthModule } from './oauth/oauth.module';
import { ImagesModule } from './images/images.module';
import loadConfig from '../config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    LoggerModule,
    BootstrapModule,
    DeploymentModule,
    OAuthModule,
    ImagesModule,
  ],
})
export class AppModule {}
