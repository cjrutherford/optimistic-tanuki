import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import loadConfig from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [loadConfig]
    }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'API_BASE_URL',
      useFactory: (config: ConfigService) => `http://${config.get('ollama.apiUrl')}:${config.get('ollama.apiPort')}`,
      inject: [ConfigService]
    }
  ],
})
export class AppModule {}
