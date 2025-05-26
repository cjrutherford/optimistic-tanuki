import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PostComponent } from './post.component';
import { CommonModule } from '@angular/common';
import { VoteComponent } from '../vote/vote.component';
import { CommentComponent } from '../comment/comment.component';
import { CommentListComponent } from '../comment/comment-list/comment-list.component';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';
import { PostDto, CommentDto, AttachmentDto } from '../../models';
import { EventEmitter } from '@angular/core';

import {
CardComponent,
ButtonComponent,
GridComponent,
TileComponent,
} from '@optimistic-tanuki/common-ui';

describe('PostComponent', () => {
let component: PostComponent;
let fixture: ComponentFixture<PostComponent>;

beforeEach(async () => {
  await TestBed.configureTestingModule({
    imports: [
      PostComponent,
      CommonModule,
      CardComponent,
      ButtonComponent,
      VoteComponent,
      CommentComponent,
      GridComponent,
      TileComponent,
      CommentListComponent,
      ProfilePhotoComponent,
    ],
  }).compileComponents();

  fixture = TestBed.createComponent(PostComponent);
  component = fixture.componentInstance;
  component.content = { id: '1', text: 'Test Post', title: '', content: '', createdAt: new Date(), userId: '123', profileId: '456' } as PostDto;
  fixture.detectChanges();
});

it('should create', () => {
  expect(component).toBeTruthy();
});

it('should initialize profile with default values', () => {
  expect(component.profile).toEqual({
    id: '',
    name: 'unknown',
    avatar: 'https://placehold.co/300x300',
  });
});

it('should set the content input', () => {
  const testPost: PostDto = { id: '123', content: 'Test Content', userId: '456', profileId: '789', createdAt: new Date(), title: '' };
  component.content = testPost;
  fixture.detectChanges();
  expect(component.content).toEqual(testPost);
});

it('should set the comments input', () => {
  const testComments: CommentDto[] = [{ id: '1', content: 'Test Comment' } as CommentDto];
  component.comments = testComments;
  fixture.detectChanges();
  expect(component.comments).toEqual(testComments);
});

it('should set the attachments input', () => {
  const testAttachments: AttachmentDto[] = [{ id: '1', name: 'Test Attachment' } as AttachmentDto];
  component.attachments = testAttachments;
  fixture.detectChanges();
  expect(component.attachments).toEqual(testAttachments);
});

it('should calculate attachmentRows correctly', () => {
  component.attachments = Array(7).fill({ id: '1', name: 'Test' });
  expect(component.attachmentRows).toBe(2);

  component.attachments = Array(12).fill({ id: '1', name: 'Test' });
  expect(component.attachmentRows).toBe(2);

  component.attachments = Array(0).fill({ id: '1', name: 'Test' });
  expect(component.attachmentRows).toBe(0);
});

it('should emit a new comment when onCommentAdd is called', () => {
  const commentContent = 'New comment';
  let emittedComment;
  component.newCommentAdded = new EventEmitter();
  component.newCommentAdded.subscribe((comment) => {
    emittedComment = comment;
  });

  component.onCommentAdd(commentContent);

  expect(emittedComment).toEqual({
    content: commentContent,
    postId: component.content.id,
    profileId: '',
  });
});

it('should emit a new comment with parentId when onCommentReply is called', () => {
  const replyEvent = { content: 'New reply', parentId: 'parent-1' };
  let emittedComment;
  component.newCommentAdded = new EventEmitter();
  component.newCommentAdded.subscribe((comment) => {
    emittedComment = comment;
  });

  component.onCommentReply(replyEvent);

  expect(emittedComment).toEqual({
    content: replyEvent.content,
    postId: component.content.id,
    profileId: '',
    parentId: replyEvent.parentId,
  });
});

it('should console log when downloadAttachment is called', () => {
  const attachment: AttachmentDto = { 
    id: '1', 
    name: 'Test.pdf', 
    url: 'http://example.com/test.pdf', 
    type: 'pdf', 
    postId: '123',
    userId: '456'
  };
  const consoleSpy = jest.spyOn(console, 'log');
  component.downloadAttachment(attachment);
  expect(consoleSpy).toHaveBeenCalledWith('Downloading attachment:', attachment);
});

it('should console log when openLink is called', () => {
  const link = { id: '1', url: 'http://example.com' };
  const consoleSpy = jest.spyOn(console, 'log');
  component.openLink(link);
  expect(consoleSpy).toHaveBeenCalledWith('Opening link:', link);
});
});