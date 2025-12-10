import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { FeedComponent } from './feed.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { PostService } from '../../post.service';
import { AttachmentService } from '../../attachment.service';
import { CommentService } from '../../comment.service';
import { ProfileService } from '../../profile.service';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { OnDestroy } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommonModule } from '@angular/common';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { ComposeComponent as SocialComposeComponent } from '@optimistic-tanuki/social-ui';

jest.mock('quill', () => ({
  Quill: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    setContents: jest.fn(),
    getContents: jest.fn(),
  })),
  register: jest.fn(),
}));
jest.mock('quill-magic-url', () => ({}), { virtual: true });
jest.mock('quill-image-compress', () => ({}), { virtual: true });
jest.mock('quill-cursors', () => ({}), { virtual: true });
jest.mock('quill-placeholder-module', () => ({}), { virtual: true });
describe('FeedComponent', () => {
  let component: FeedComponent & Partial<OnDestroy>;
  let fixture: ComponentFixture<FeedComponent>;
  let postService: PostService;
  let profileService: ProfileService;
  let router: Router;

  beforeEach(() => {
    const themeServiceMock = {
      themeColors$: of({
        background: '#ffffff',
        foreground: '#212121',
        accent: '#3f51b5',
      }),
    };
    const postServiceMock = {
      searchPosts: jest.fn().mockReturnValue(of([])),
    };
    const profileServiceMock = {
      currentUserProfile: jest
        .fn()
        .mockReturnValue({ id: '123', profileName: 'Test', profilePic: 'url' }),
      getDisplayProfile: jest
        .fn()
        .mockReturnValue(
          of({ id: '1', profileName: 'Test', profilePic: 'url' })
        ),
    };
    const routerMock = {
      navigate: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [FeedComponent, HttpClientTestingModule, CommonModule],
      providers: [
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: PostService, useValue: postServiceMock },
        { provide: AttachmentService, useValue: {} },
        { provide: CommentService, useValue: {} },
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
    postService = TestBed.inject(PostService);
    profileService = TestBed.inject(ProfileService);
    router = TestBed.inject(Router);
  });

  it('should create', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component).toBeTruthy();
  }));
});
