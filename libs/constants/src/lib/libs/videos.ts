// Video Service Commands
export const VideoCommands = {
  // Video commands
  CREATE_VIDEO: 'create-video',
  FIND_ALL_VIDEOS: 'find-all-videos',
  FIND_ONE_VIDEO: 'find-one-video',
  UPDATE_VIDEO: 'update-video',
  DELETE_VIDEO: 'delete-video',
  FIND_VIDEOS_BY_CHANNEL: 'find-videos-by-channel',
  FIND_RECOMMENDED_VIDEOS: 'find-recommended-videos',
  FIND_TRENDING_VIDEOS: 'find-trending-videos',
  INCREMENT_VIEW_COUNT: 'increment-view-count',
  INCREMENT_LIKE_COUNT: 'increment-like-count',
  DECREMENT_LIKE_COUNT: 'decrement-like-count',

  // Channel commands
  CREATE_CHANNEL: 'create-channel',
  FIND_ALL_CHANNELS: 'find-all-channels',
  FIND_ONE_CHANNEL: 'find-one-channel',
  UPDATE_CHANNEL: 'update-channel',
  DELETE_CHANNEL: 'delete-channel',
  FIND_CHANNELS_BY_USER: 'find-channels-by-user',

  // Channel subscription commands
  SUBSCRIBE_TO_CHANNEL: 'subscribe-to-channel',
  UNSUBSCRIBE_FROM_CHANNEL: 'unsubscribe-from-channel',
  FIND_USER_SUBSCRIPTIONS: 'find-user-subscriptions',
  FIND_CHANNEL_SUBSCRIBERS: 'find-channel-subscribers',

  // Video view commands
  RECORD_VIDEO_VIEW: 'record-video-view',
  FIND_VIDEO_VIEWS: 'find-video-views',
};
