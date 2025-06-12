import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventEmitter } from '@angular/core';
import { FeedComponent } from './feed.component';
import { ThemeService } from '@optimistic-tanuki/theme-ui';
import { PostService } from '../../post.service';
import { AttachmentService } from '../../attachment.service';
import { CommentService } from '../../comment.service';
import { ProfileService } from '../../profile.service';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { Component, OnDestroy, Output } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommonModule } from '@angular/common';

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
  let themeService: ThemeService;
  let postService: PostService;
  let profileService: ProfileService;
  let router: Router;

  beforeEach(() => {
    const themeServiceMock = {
      themeColors$: of({ background: 'bg', foreground: 'fg', accent: 'ac' }),
    };
    const postServiceMock = {
      searchPosts: jest.fn().mockReturnValue(of([])),
    };
    const profileServiceMock = {
      currentUserProfile: jest.fn().mockReturnValue({ id: '123', profileName: 'Test', profilePic: 'url' }),
      getDisplayProfile: jest.fn().mockReturnValue(of({ id: '1', profileName: 'Test', profilePic: 'url' })),
    };
    const routerMock = {
      navigate: jest.fn(),
    };

    // Mock ComposeComponent
    @Component({
      selector: 'lib-compose',
      template: '',
      standalone: true,
      imports: [],
      styles: [],
    })
    class MockComposeComponent {
      @Output() postSubmitted = new EventEmitter<any>();
    }

    TestBed.configureTestingModule({
      imports: [FeedComponent, HttpClientTestingModule, CommonModule],
      providers: [
      { provide: ThemeService, useValue: themeServiceMock },
      { provide: PostService, useValue: postServiceMock },
      { provide: AttachmentService, useValue: {} },
      { provide: CommentService, useValue: {} },
      { provide: ProfileService, useValue: profileServiceMock },
      { provide: Router, useValue: routerMock },
      ],
    }).overrideComponent(FeedComponent, {
      set: {
        imports: [MockComposeComponent, CommonModule], // Add CommonModule for ngFor/ngIf support
      },
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    postService = TestBed.inject(PostService);
    profileService = TestBed.inject(ProfileService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize theme styles on ngOnInit', () => {
    // The test expects themeStyles to be set to specific values.
    // But the mock themeColors$ returns { background: 'bg', foreground: 'fg', accent: 'ac' }
    // If FeedComponent uses these values directly, the test will fail unless it maps them to the expected values.
    // If FeedComponent expects actual color values, update the mock to match.
    component.ngOnInit();
    expect(component.themeStyles).toEqual({
      backgroundColor: '#fff',
      color: '#333',
      border: '1px solid #3f51b5',
    });
  });

  it('should search posts if current profile exists', () => {
    const profile: ProfileDto = { 
      id: '123', 
      profileName: 'Test Profile', 
      profilePic: 'url', 
      bio: '', 
      userId: '123',   
      coverPic: "url",
      created_at: new Date(),
      interests: '',
      occupation: '',
      skills: '',
      location: '',
    };
    const userProfileSpy = jest.spyOn(profileService, 'currentUserProfile').mockReturnValue(profile);
    component.ngOnInit();
    expect(userProfileSpy).toHaveBeenCalled();
  });

  it('should navigate to /profile if no current profile exists', () => {
    jest.spyOn(profileService, 'currentUserProfile').mockReturnValue(null);
    component.ngOnInit();
    expect(router.navigate).toHaveBeenCalledWith(['/profile']);
  });

  it('should unsubscribe from themeColors$ and postService on destroy', () => {
    component.destroy$ = new Subject<void>();
    const nextSpy = jest.spyOn(component.destroy$, 'next');
    const completeSpy = jest.spyOn(component.destroy$, 'complete');

    component!.ngOnDestroy();

    expect(nextSpy).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
  });
});