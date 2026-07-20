import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommunitiesComponent } from './communities.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CommunityService } from '../../services/community.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { Router } from '@angular/router';

const communityServiceMock = {
  getCommunities: jest.fn().mockResolvedValue([]),
};

describe('CommunitiesComponent', () => {
  let component: CommunitiesComponent;
  let fixture: ComponentFixture<CommunitiesComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommunitiesComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(CommunitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('returns to the locality index through locality-first routes', () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.navigateToCities();

    expect(navigateSpy).toHaveBeenCalledWith(['/localities']);
  });
});
