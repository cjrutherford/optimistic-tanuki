import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { CreateCommunityComponent } from './create-community.component';
import { CommunityService } from '../services/community.service';
import { OptomisitcTanukiAPIService as ProfileAPIService } from '@optimistic-tanuki/profile-ui-data-access';

describe('CreateCommunityComponent upload contract', () => {
  let component: CreateCommunityComponent;
  let fixture: ComponentFixture<CreateCommunityComponent>;
  let httpMock: HttpTestingController;
  let communityService: { create: jest.Mock };

  const startSelect = (
    handler: (event: Event) => Promise<void>,
    name: string
  ) => {
    const file = new File(['image-bytes'], name, { type: 'image/png' });
    return handler.call(component, {
      target: { files: [file], value: '' },
    } as unknown as Event);
  };

  beforeEach(async () => {
    communityService = {
      create: jest.fn().mockResolvedValue({ id: 'c-1', slug: 'test' }),
    };

    await TestBed.configureTestingModule({
      imports: [CreateCommunityComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CommunityService, useValue: communityService },
        {
          provide: ProfileAPIService,
          useValue: {
            profileControllerGetCurrentProfile: jest
              .fn()
              .mockReturnValue(of({ id: 'profile-1' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateCommunityComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    component.communityForm.patchValue({ name: 'Test Community' });
  });

  afterEach(() => {
    httpMock.verify();
  });

  const spinnerVisible = (): boolean => {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('otui-spinner') !== null;
  };

  it('uploads once on select and creates with asset IDs only', async () => {
    await startSelect(component.onLogoSelect, 'logo.png');
    const logoReq = httpMock.expectOne('/api/asset');
    expect(component.logoUploading()).toBe(true);
    expect(spinnerVisible()).toBe(true);

    logoReq.flush({ id: 'logo-1' });
    await fixture.whenStable();
    expect(component.logoUploading()).toBe(false);
    expect(component.logoAssetId()).toBe('logo-1');
    expect(spinnerVisible()).toBe(false);

    await startSelect(component.onBannerSelect, 'banner.png');
    httpMock.expectOne('/api/asset').flush({ id: 'banner-1' });
    await fixture.whenStable();

    await component.onSubmit();
    expect(communityService.create).toHaveBeenCalledTimes(1);
    const dto = communityService.create.mock.calls[0][0];
    expect(dto).toEqual(
      expect.objectContaining({
        name: 'Test Community',
        bannerAssetId: 'banner-1',
        logoAssetId: 'logo-1',
      })
    );
    expect(dto).not.toHaveProperty('imageUrl');
    expect(dto).not.toHaveProperty('content');
    expect(JSON.stringify(dto)).not.toContain('data:');
  });

  it('does not re-upload on retry/resubmit', async () => {
    await startSelect(component.onLogoSelect, 'logo.png');
    httpMock.expectOne('/api/asset').flush({ id: 'logo-1' });
    await fixture.whenStable();

    await component.onSubmit();
    await component.onSubmit();

    httpMock.expectNone('/api/asset');
    expect(communityService.create).toHaveBeenCalledTimes(2);
  });

  it('blocks submit while an upload is pending', async () => {
    await startSelect(component.onLogoSelect, 'logo.png');
    const logoReq = httpMock.expectOne('/api/asset');

    await component.onSubmit();
    expect(communityService.create).not.toHaveBeenCalled();

    logoReq.flush({ id: 'logo-1' });
    await fixture.whenStable();
    await component.onSubmit();
    expect(communityService.create).toHaveBeenCalledTimes(1);
  });

  it('hides the spinner and surfaces an error when the upload rejects', async () => {
    await startSelect(component.onLogoSelect, 'logo.png');
    const logoReq = httpMock.expectOne('/api/asset');
    expect(component.logoUploading()).toBe(true);

    logoReq.error(new ProgressEvent('error'), { status: 500 });
    await fixture.whenStable();

    expect(component.logoUploading()).toBe(false);
    expect(spinnerVisible()).toBe(false);
    expect(component.error()).toMatch(/logo/i);

    // A failed upload must not silently create without the image.
    await component.onSubmit();
    expect(communityService.create).not.toHaveBeenCalled();
  });

  it('remove-image clears pending state so a late upload cannot repopulate it', async () => {
    await startSelect(component.onLogoSelect, 'logo.png');
    const logoReq = httpMock.expectOne('/api/asset');
    component.clearLogo();
    expect(component.logoUploading()).toBe(false);

    logoReq.flush({ id: 'logo-late' });
    await fixture.whenStable();

    expect(component.logoPreview()).toBeNull();
    expect(component.logoAssetId()).toBeNull();
  });
});
