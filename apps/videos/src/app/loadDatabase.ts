import { DataSourceOptions } from 'typeorm';
import { Channel } from '../entities/channel.entity';
import { Video } from '../entities/video.entity';
import { ChannelSubscription } from '../entities/channel-subscription.entity';
import { VideoView } from '../entities/video-view.entity';
import { ChannelFeed } from '../entities/channel-feed.entity';
import { ProgramBlock } from '../entities/program-block.entity';
import { LiveSession } from '../entities/live-session.entity';
import { ConfigService } from '@nestjs/config';

export default function loadDatabase(config: ConfigService): DataSourceOptions {
  const database = config.get('database');
  const entities = [
    Channel,
    Video,
    ChannelSubscription,
    VideoView,
    ChannelFeed,
    ProgramBlock,
    LiveSession,
  ];
  const {
    host, port, username, password, database: dbName
  } = database;
  const ormConfig: DataSourceOptions = {
    type: 'postgres',
    host: host,
    port: port,
    username: username,
    password: password,
    database: dbName,
    entities,
    synchronize: process.env['NODE_ENV'] !== 'production',
    logging: process.env['NODE_ENV'] === 'development',
  };
  console.log('Database configuration:', { ...ormConfig, password: '[REDACTED]' });
  return ormConfig;
  // const dataSource = new DataSource({
  //   type: 'postgres',
  //   host: process.env['POSTGRES_HOST'] || 'localhost',
  //   port: parseInt(process.env['POSTGRES_PORT'] || '5432'),
  //   username: process.env['POSTGRES_USER'] || 'postgres',
  //   password: process.env['POSTGRES_PASSWORD'] || 'postgres',
  //   database: process.env['POSTGRES_DB'] || 'videos',
  //   entities: [Channel, Video, ChannelSubscription, VideoView],
  //   synchronize: process.env['NODE_ENV'] !== 'production',
  //   logging: process.env['NODE_ENV'] === 'development',
  // });

  // await dataSource.initialize();
  // return dataSource;
}
