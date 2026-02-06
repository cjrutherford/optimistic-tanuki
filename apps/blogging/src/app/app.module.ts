import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import {
  EventController,
  PostController,
  ContactController,
  BlogController,
  BlogComponentController,
} from './controllers';
import {
  EventService,
  PostService,
  ContactService,
  BlogService,
  BlogComponentService,
  RssService,
  SeoService,
  SitemapService,
  SpamProtectionService,
  SanitizationService,
} from './services';
import config from './config';
import loadDatabase from './loadDatabase';
import { DataSource } from 'typeorm';
import { Contact, Event, Post, Blog, BlogComponent } from './entities';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),
    DatabaseModule.register({
      name: 'blogging',
      factory: loadDatabase,
    }),
  ],
  controllers: [
    EventController,
    PostController,
    ContactController,
    BlogController,
    BlogComponentController,
  ],
  providers: [
    EventService,
    PostService,
    ContactService,
    BlogService,
    BlogComponentService,
    RssService,
    SeoService,
    SitemapService,
    SpamProtectionService,
    SanitizationService,
    {
      provide: getRepositoryToken(Post),
      useFactory: (ds: DataSource) => ds.getRepository(Post),
      inject: ['BLOGGING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Event),
      useFactory: (ds: DataSource) => ds.getRepository(Event),
      inject: ['BLOGGING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Contact),
      useFactory: (ds: DataSource) => ds.getRepository(Contact),
      inject: ['BLOGGING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Blog),
      useFactory: (ds: DataSource) => ds.getRepository(Blog),
      inject: ['BLOGGING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(BlogComponent),
      useFactory: (ds: DataSource) => ds.getRepository(BlogComponent),
      inject: ['BLOGGING_CONNECTION'],
    },
  ],
})
export class AppModule {}
