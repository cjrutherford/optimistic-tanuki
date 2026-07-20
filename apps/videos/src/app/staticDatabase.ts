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
  PlaylistDecisionHistory,
  Video,
  VideoView,
} from '../entities';
import { Initial1770152975983 } from '../../migrations/1770152975983-initial';
import { CommunityBroadcast1776436200000 } from '../../migrations/1776436200000-community-broadcast';
import { VideoProcessingPipeline1776522000000 } from '../../migrations/1776522000000-video-processing-pipeline';
import { ChannelAnchorColumns1782648000000 } from '../../migrations/1782648000000-channel-anchor-columns';
import { ChannelBusinessPage1783420800000 } from '../../migrations/1783420800000-channel-business-page';
import { PersistBroadcastPlaylistDecisions1783600000000 } from '../../migrations/1783600000000-persist-broadcast-playlist-decisions';
import { PersistBroadcastPlaylistDecisionHistory1783610000000 } from '../../migrations/1783610000000-persist-broadcast-playlist-decision-history';

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
  PlaylistDecisionHistory,
];
const migrations = [
  Initial1770152975983,
  CommunityBroadcast1776436200000,
  VideoProcessingPipeline1776522000000,
  ChannelAnchorColumns1782648000000,
  ChannelBusinessPage1783420800000,
  PersistBroadcastPlaylistDecisions1783600000000,
  PersistBroadcastPlaylistDecisionHistory1783610000000,
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
