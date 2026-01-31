import { DataSource } from 'typeorm';
import { Channel } from '../entities/channel.entity';
import { Video } from '../entities/video.entity';
import { ChannelSubscription } from '../entities/channel-subscription.entity';
import { VideoView } from '../entities/video-view.entity';

export default async function loadDatabase(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env['POSTGRES_HOST'] || 'localhost',
    port: parseInt(process.env['POSTGRES_PORT'] || '5432'),
    username: process.env['POSTGRES_USER'] || 'postgres',
    password: process.env['POSTGRES_PASSWORD'] || 'postgres',
    database: process.env['POSTGRES_DB'] || 'videos',
    entities: [Channel, Video, ChannelSubscription, VideoView],
    synchronize: process.env['NODE_ENV'] !== 'production',
    logging: process.env['NODE_ENV'] === 'development',
  });

  await dataSource.initialize();
  return dataSource;
}
