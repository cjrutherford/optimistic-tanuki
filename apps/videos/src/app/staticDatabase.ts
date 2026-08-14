import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import {
  Channel,
  ChannelFeed,
  ChannelSubscription,
  LiveSession,
  ProgramBlock,
  Video,
  VideoView,
} from '../entities';
import { Initial1770152975983 } from '../../migrations/1770152975983-initial';
import { CommunityBroadcast1786715103205 } from '../../migrations/1786715103205-community-broadcast';
import { VideoProcessingPipeline1786715106275 } from '../../migrations/1786715106275-video-processing-pipeline';

const config = yaml.load(
  fs.readFileSync(path.resolve(__dirname, '../assets/config.yaml'), 'utf8')
) as Record<string, any>;
const {
  database: {
    host: configHost, // Renamed to avoid conflict
    port,
    username,
    password,
    name: configName, // Renamed to avoid conflict
    database: configDatabase, // Renamed to avoid conflict
  },
} = config;

// Default to localhost for host-side migration work; Docker sets POSTGRES_HOST=db.
const host = process.env.POSTGRES_HOST || 'localhost';
// Use environment variable for database name if available, otherwise use configDatabase or configName
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [
  Channel,
  ChannelFeed,
  ChannelSubscription,
  LiveSession,
  ProgramBlock,
  Video,
  VideoView,
];
const migrations = [
  Initial1770152975983,
  CommunityBroadcast1786715103205,
  VideoProcessingPipeline1786715106275,
];

const staticSource = new DataSource({
  type: 'postgres',
  host: host, // Use the potentially overridden host
  port: Number(port),
  username,
  password,
  database: database, // Use the potentially overridden database name
  entities,
  migrations,
});
export default staticSource;
