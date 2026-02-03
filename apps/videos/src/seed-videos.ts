import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ChannelService } from './app/services/channel.service';
import { VideoService } from './app/services/video.service';
import { SubscriptionService } from './app/services/subscription.service';
import { Logger } from '@nestjs/common';
import { CreateVideoDto, VideoDto, VideoVisibility } from '@optimistic-tanuki/models';

async function bootstrap() {
  const logger = new Logger('VideoSeedScript');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const channelService = app.get(ChannelService);
    const videoService = app.get(VideoService);
    const subscriptionService = app.get(SubscriptionService);

    logger.log('Seeding video database with sample data...');

    // Sample user and profile IDs (these should match your existing users)
    const sampleUsers = [
      { userId: '00000000-0000-0000-0000-000000000001', profileId: '00000000-0000-0000-0000-000000000001' },
      { userId: '00000000-0000-0000-0000-000000000002', profileId: '00000000-0000-0000-0000-000000000002' },
      { userId: '00000000-0000-0000-0000-000000000003', profileId: '00000000-0000-0000-0000-000000000003' },
    ];

    // Create sample channels
    const channels = [
      {
        name: 'Tech Tutorials',
        description: 'Learn programming, web development, and software engineering with our comprehensive tutorials.',
        profileId: sampleUsers[0].profileId,
        userId: sampleUsers[0].userId,
      },
      {
        name: 'Cooking Adventures',
        description: 'Delicious recipes and cooking tips from around the world. Join us on a culinary journey!',
        profileId: sampleUsers[1].profileId,
        userId: sampleUsers[1].userId,
      },
      {
        name: 'Fitness & Health',
        description: 'Get fit and stay healthy with our workout routines, nutrition advice, and wellness tips.',
        profileId: sampleUsers[2].profileId,
        userId: sampleUsers[2].userId,
      },
    ];

    const createdChannels = [];
    for (const channelData of channels) {
      try {
        const channel = await channelService.create(channelData);
        createdChannels.push(channel);
        logger.log(`Created channel: ${channel.name}`);
      } catch (error) {
        logger.warn(`Channel "${channelData.name}" may already exist: ${error.message}`);
      }
    }

    // Create sample videos
    const videos: CreateVideoDto[] = [
      // Tech Tutorials Channel
      {
        title: 'Getting Started with NestJS',
        description: 'Learn the basics of NestJS framework and build your first API.',
        channelId: createdChannels[0]?.id,
        assetId: '00000000-0000-0000-0000-000000000001',
        durationSeconds: 1245,
        resolution: '1920x1080',
        encoding: 'H.264',
        visibility: VideoVisibility.PUBLIC,
      },
      {
        title: 'Angular Best Practices 2024',
        description: 'Discover the best practices for Angular development in 2024.',
        channelId: createdChannels[0]?.id,
        assetId: '00000000-0000-0000-0000-000000000002',
        durationSeconds: 1876,
        resolution: '1920x1080',
        encoding: 'H.264',
        visibility: VideoVisibility.PUBLIC,
      },
      {
        title: 'TypeScript Advanced Features',
        description: 'Deep dive into advanced TypeScript features and patterns.',
        channelId: createdChannels[0]?.id,
        assetId: '00000000-0000-0000-0000-000000000003',
        durationSeconds: 2156,
        resolution: '1920x1080',
        encoding: 'H.264',
        visibility: VideoVisibility.PUBLIC,
      },

      // Cooking Adventures Channel
      {
        title: 'Perfect Homemade Pizza',
        description: 'Learn how to make authentic Italian pizza from scratch at home.',
        channelId: createdChannels[1]?.id,
        assetId: '00000000-0000-0000-0000-000000000004',
        durationSeconds: 945,
        resolution: '1920x1080',
        encoding: 'H.264',
        visibility: VideoVisibility.PUBLIC,
      },
      {
        title: 'Thai Green Curry Recipe',
        description: 'A step-by-step guide to making delicious Thai green curry.',
        channelId: createdChannels[1]?.id,
        assetId: '00000000-0000-0000-0000-000000000005',
        durationSeconds: 1123,
        resolution: '1920x1080',
        encoding: 'H.264',
        visibility: VideoVisibility.PUBLIC,
      },

      // Fitness & Health Channel
      {
        title: '30-Minute Full Body Workout',
        description: 'An effective full-body workout routine you can do at home.',
        channelId: createdChannels[2]?.id,
        assetId: '00000000-0000-0000-0000-000000000006',
        durationSeconds: 1876,
        resolution: '1920x1080',
        encoding: 'H.264',
        visibility: VideoVisibility.PUBLIC,
      },
      {
        title: 'Meal Prep for Beginners',
        description: 'Simple and healthy meal prep ideas for busy people.',
        channelId: createdChannels[2]?.id,
        assetId: '00000000-0000-0000-0000-000000000007',
        durationSeconds: 1456,
        resolution: '1920x1080',
        encoding: 'H.264',
        visibility: VideoVisibility.PUBLIC,
      },
    ];

    for (const videoData of videos) {
      try {
        if (videoData.channelId) {
          const video = await videoService.create(videoData);
          logger.log(`Created video: ${video.title}`);
        }
      } catch (error) {
        logger.warn(`Could not create video: ${error.message}`);
      }
    }

    // Create some sample subscriptions
    logger.log('Creating sample subscriptions...');
    const subscriptions = [
      // User 1 subscribes to channel 2 and 3
      {
        channelId: createdChannels[1]?.id,
        userId: sampleUsers[0].userId,
        profileId: sampleUsers[0].profileId,
      },
      {
        channelId: createdChannels[2]?.id,
        userId: sampleUsers[0].userId,
        profileId: sampleUsers[0].profileId,
      },
      // User 2 subscribes to channel 1 and 3
      {
        channelId: createdChannels[0]?.id,
        userId: sampleUsers[1].userId,
        profileId: sampleUsers[1].profileId,
      },
      {
        channelId: createdChannels[2]?.id,
        userId: sampleUsers[1].userId,
        profileId: sampleUsers[1].profileId,
      },
    ];

    for (const subscriptionData of subscriptions) {
      try {
        if (subscriptionData.channelId) {
          await subscriptionService.subscribe(subscriptionData);
          logger.log(`Created subscription for user ${subscriptionData.userId} to channel ${subscriptionData.channelId}`);
        }
      } catch (error) {
        logger.warn(`Could not create subscription: ${error.message}`);
      }
    }

    logger.log('✅ Video database seeding completed successfully!');
    logger.log(`Created ${createdChannels.length} channels`);
    logger.log(`Created ${videos.length} videos`);
    logger.log(`Created ${subscriptions.length} subscriptions`);
  } catch (error) {
    logger.error('Error seeding video database:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
