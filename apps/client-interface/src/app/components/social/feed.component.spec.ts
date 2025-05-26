import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeedComponent } from './feed.component';
import { ThemeService } from '@optimistic-tanuki/theme-ui';
import { PostService } from '../../post.service';
import { AttachmentService } from '../../attachment.service';
import { CommentService } from '../../comment.service';
import { ProfileService } from '../../profile.service';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { OnDestroy } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';

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

    TestBed.configureTestingModule({
      imports: [FeedComponent, HttpClientTestingModule],
      providers: [
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: PostService, useValue: postServiceMock },
        { provide: AttachmentService, useValue: {} },
        { provide: CommentService, useValue: {} },
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

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