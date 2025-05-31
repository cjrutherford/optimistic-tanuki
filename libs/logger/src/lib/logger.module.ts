import { Logger, Module } from '@nestjs/common';

@Module({
  controllers: [],
  providers: [{
    provide: Logger,
    useClass: Logger
  }],
  exports: [Logger],
})
export class LoggerModule {}
