import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@optimistic-tanuki/logger';
import loadConfig, { resolveOllamaEndpoint } from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [loadConfig],
    }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'API_BASE_URL',
      useFactory: (config: ConfigService) =>
        resolveOllamaEndpoint({
          apiUrl: config.get<string>('ollama.apiUrl'),
          apiPort: config.get<string | number>('ollama.apiPort'),
        }),
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
