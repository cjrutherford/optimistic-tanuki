import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PostComponent, PostProfileStub } from './post.component';
import { CommonModule } from '@angular/common';
import { VoteComponent } from '../vote/vote.component';
import { CommentComponent } from '../comment/comment.component';
import { CommentListComponent } from '../comment/comment-list/comment-list.component';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';
import { PostDto, CommentDto, AttachmentDto } from '../../models';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

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
      providers: [
        ThemeService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostComponent);
    component = fixture.componentInstance;
    component.content = {
      id: '1',
      text: 'Test Post',
      title: '',
      content: '',
      createdAt: new Date(),
      userId: '123',
      profileId: '456',
    } as PostDto;
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
    expect(component.content).toBeDefined();
    expect(component.content.id).toBe('1');
  });

  it('should set the comments input', () => {
    const testComments: CommentDto[] = [
      { id: '1', content: 'Test Comment' } as CommentDto,
    ];
    component.comments = testComments;
    expect(component.comments).toEqual(testComments);
  });

  it('should set the attachments input', () => {
    const testAttachments: AttachmentDto[] = [
      { id: '1', url: 'http://example.com/attachment.jpg' } as AttachmentDto,
    ];
    component.attachments = testAttachments;
    expect(component.attachments).toEqual(testAttachments);
  });

  it('should calculate attachmentRows correctly', () => {
    component.attachments = [
      { id: '1' } as AttachmentDto,
      { id: '2' } as AttachmentDto,
      { id: '3' } as AttachmentDto,
      { id: '4' } as AttachmentDto,
    ];
    expect(component.attachmentRows).toBe(1);
  });

  it('should emit a new comment when onCommentAdd is called', () => {
    jest.spyOn(component.newCommentAdded, 'emit');
    component.onCommentAdd('Test comment content');
    expect(component.newCommentAdded.emit).toHaveBeenCalled();
  });

  it('should emit a new comment with parentId when onCommentReply is called', () => {
    jest.spyOn(component.newCommentAdded, 'emit');
    component.onCommentReply({
      content: 'Reply',
      parentId: 'parent123',
    });
    expect(component.newCommentAdded.emit).toHaveBeenCalled();
  });

  it('should console log when downloadAttachment is called', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const attachment = {
      id: '1',
      url: 'http://example.com/file.pdf',
    } as AttachmentDto;
    component.downloadAttachment(attachment);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should console log when openLink is called', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const link = { url: 'http://example.com' };
    component.openLink(link);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('renders persisted inline image dimensions from post HTML', () => {
    component.content = {
      id: 'post-1',
      title: 't',
      content: '<p><img src="/img.png" width="320" height="180" /></p>',
      profileId: 'profile-1',
      userId: 'user-1',
      createdAt: new Date(),
    } as any;

    fixture.detectChanges();

    const image: HTMLImageElement | null =
      fixture.nativeElement.querySelector('.post-content img');

    expect(image).not.toBeNull();
    expect(image?.getAttribute('width')).toBe('320');
    expect(image?.getAttribute('height')).toBe('180');
  });

  it('does not force persisted-height inline images back to auto sizing', () => {
    const styles = readFileSync(
      resolve(
        process.cwd(),
        'libs/social-ui/src/lib/social-ui/post/post.component.scss'
      ),
      'utf8'
    );

    expect(styles).toMatch(/img\[height\][^{]*\{[^}]*height:\s*unset/);
  });

  it('treats the matching profile as editable for the current user', () => {
    component.currentUserId = '456';

    fixture.detectChanges();

    expect(component.canEdit()).toBe(true);
  });

  it('shows an edited badge when the post has been updated', () => {
    component.content = {
      ...component.content,
      createdAt: new Date('2026-07-05T10:00:00.000Z'),
      updatedAt: new Date('2026-07-05T10:05:00.000Z'),
    } as PostDto;

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Edited');
  });
});
