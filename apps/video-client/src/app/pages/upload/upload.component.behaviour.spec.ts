import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ChannelDto, VideoDto } from '@optimistic-tanuki/ui-models';
import { UploadComponent } from './upload.component';
import { VideoService } from '../../services/video.service';
import { ProfileService } from '../../services/profile.service';

/**
 * TS4111 is enabled workspace-wide, so the collaborator doubles are declared as
 * named interfaces rather than index-signature maps.
 */
interface VideoServiceStub {
  getChannels: jest.Mock<Observable<ChannelDto[]>, []>;
  createVideo: jest.Mock<Observable<VideoDto>, [unknown]>;
}

interface RouterStub {
  navigate: jest.Mock;
}

interface ProfileServiceStub {
  getCurrentUserProfile: jest.Mock;
}

/**
 * Captured before the fake timers are installed so the polling helper below can
 * still yield a real macrotask while the component's redirect timer is faked.
 */
const realSetTimeout = globalThis.setTimeout;

const channelFixture: ChannelDto = {
  id: 'channel-1',
  name: 'Optimistic Tanuki Live',
  profileId: 'profile-1',
  userId: 'user-1',
  communityId: 'community-1',
  createdAt: new Date('2026-04-17T14:00:00.000Z'),
  updatedAt: new Date('2026-04-17T14:00:00.000Z'),
};

const videoFixture: VideoDto = {
  id: 'video-1',
  title: 'Tanuki tour',
  assetId: 'asset-video',
  channelId: 'channel-1',
  processingStatus: 'pending',
  viewCount: 0,
  likeCount: 0,
  visibility: 'public',
  createdAt: new Date('2026-04-17T14:00:00.000Z'),
  updatedAt: new Date('2026-04-17T14:00:00.000Z'),
};

describe('UploadComponent behaviour', () => {
  let videoService: VideoServiceStub;
  let router: RouterStub;
  let profileService: ProfileServiceStub;
  let http: HttpTestingController;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    // The component chains FileReader (which jsdom drives with setImmediate)
    // into an HTTP call and finally a 2s redirect timer. Faking only the timer
    // family keeps the reader real so the promise chain still settles.
    jest.useFakeTimers({
      doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'],
    });
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    videoService = {
      getChannels: jest.fn(() => of([channelFixture])),
      createVideo: jest.fn(() => of(videoFixture)),
    };
    router = { navigate: jest.fn() };
    profileService = {
      getCurrentUserProfile: jest.fn(() => ({ id: 'profile-1' })),
    };
  });

  afterEach(() => {
    http.verify();
    consoleError.mockRestore();
    jest.useRealTimers();
  });

  function createComponent(): UploadComponent {
    TestBed.configureTestingModule({
      imports: [UploadComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: VideoService, useValue: videoService },
        { provide: Router, useValue: router },
        { provide: ProfileService, useValue: profileService },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(UploadComponent).componentInstance;
  }

  /**
   * The asset POST is only issued once the FileReader promise resolves, so the
   * request is polled for across macrotask boundaries instead of assuming a
   * fixed number of ticks.
   */
  async function awaitRequest(url: string): Promise<TestRequest> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const matches = http.match(url);
      if (matches.length > 0) return matches[0];
      await new Promise((resolve) => realSetTimeout(resolve, 0));
    }
    throw new Error(`No request to ${url} was issued`);
  }

  function fileWith(name: string, contents: string): File {
    return new File([contents], name, { type: 'application/octet-stream' });
  }

  describe('channel loading', () => {
    it('exposes the channels returned by the video service', () => {
      const component = createComponent();

      expect(videoService.getChannels).toHaveBeenCalled();
      expect(component.channels).toEqual([channelFixture]);
    });

    it('reports a channel load failure and leaves the channel list empty', () => {
      const failure = new Error('channels unavailable');
      videoService.getChannels.mockReturnValue(throwError(() => failure));

      const component = createComponent();

      expect(component.channels).toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load channels:',
        failure
      );
    });
  });

  describe('thumbnail selection', () => {
    it('keeps the chosen thumbnail file', () => {
      const component = createComponent();
      const thumbnail = fileWith('thumb.png', 'png-bytes');

      component.onThumbnailFileSelected({ target: { files: [thumbnail] } });

      expect(component.thumbnailFile).toBe(thumbnail);
    });

    it('leaves the thumbnail unset when the picker is dismissed', () => {
      const component = createComponent();

      component.onThumbnailFileSelected({ target: { files: [] } });

      expect(component.thumbnailFile).toBeNull();
    });
  });

  describe('submitting', () => {
    it('refuses to submit without a video file', async () => {
      const component = createComponent();

      await component.onSubmit();

      expect(component.error).toBe('Please select a video file');
      expect(component.uploading).toBe(false);
      expect(videoService.createVideo).not.toHaveBeenCalled();
    });

    it('uploads the video asset then creates the video record and redirects', async () => {
      const component = createComponent();
      component.videoFile = fileWith('tour.mp4', 'video-bytes');
      component.videoData = {
        title: 'Tanuki tour',
        description: 'A tour',
        channelId: 'channel-1',
        visibility: 'unlisted',
      };

      const submission = component.onSubmit();

      const assetRequest = await awaitRequest('/api/asset');
      expect(assetRequest.request.method).toBe('POST');
      expect(assetRequest.request.body).toMatchObject({
        name: 'tour.mp4',
        type: 'video',
        fileExtension: 'mp4',
        profileId: 'profile-1',
      });
      // The data: prefix is stripped before upload, leaving raw base64.
      expect(atob(assetRequest.request.body.content)).toBe('video-bytes');
      assetRequest.flush({ id: 'asset-video' });

      await submission;

      expect(videoService.createVideo).toHaveBeenCalledWith({
        title: 'Tanuki tour',
        description: 'A tour',
        assetId: 'asset-video',
        thumbnailAssetId: undefined,
        channelId: 'channel-1',
        visibility: 'unlisted',
      });
      expect(component.success).toBe(true);
      expect(component.uploading).toBe(false);
      expect(component.uploadProgress).toBe(100);

      expect(router.navigate).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2000);
      expect(router.navigate).toHaveBeenCalledWith(['/watch', 'video-1']);
    });

    it('attributes the asset to the signed-in profile', async () => {
      // Previously hardcoded to 'user-profile-id', so every upload in the
      // running app was filed against a profile that does not exist.
      profileService.getCurrentUserProfile.mockReturnValue({ id: 'profile-9' });
      const component = createComponent();
      component.videoFile = fileWith('tour.mp4', 'video-bytes');

      const submission = component.onSubmit();
      const assetRequest = await awaitRequest('/api/asset');

      expect(assetRequest.request.body.profileId).toBe('profile-9');
      assetRequest.flush({ id: 'asset-video' });
      await submission;
    });

    it('refuses to upload when no profile is selected', async () => {
      profileService.getCurrentUserProfile.mockReturnValue(null);
      const component = createComponent();
      component.videoFile = fileWith('tour.mp4', 'video-bytes');

      await component.onSubmit();

      // Nothing is sent: an unattributed asset would be orphaned.
      expect(component.error).toBe('Failed to upload file');
      expect(component.uploading).toBe(false);
      expect(videoService.createVideo).not.toHaveBeenCalled();
    });

    it('uploads a thumbnail asset as well when one was chosen', async () => {
      const component = createComponent();
      component.videoFile = fileWith('tour.mp4', 'video-bytes');
      component.thumbnailFile = fileWith('thumb.png', 'png-bytes');
      component.videoData.title = 'Tanuki tour';
      component.videoData.channelId = 'channel-1';

      const submission = component.onSubmit();

      // The component awaits the video upload before starting the thumbnail
      // upload, so the two requests arrive strictly in sequence.
      (await awaitRequest('/api/asset')).flush({ id: 'asset-video' });
      const thumbnailRequest = await awaitRequest('/api/asset');
      expect(thumbnailRequest.request.body).toMatchObject({
        name: 'thumb.png',
        type: 'image',
        fileExtension: 'png',
      });
      thumbnailRequest.flush({ id: 'asset-thumb' });

      await submission;

      expect(videoService.createVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: 'asset-video',
          thumbnailAssetId: 'asset-thumb',
        })
      );

      jest.advanceTimersByTime(2000);
      expect(router.navigate).toHaveBeenCalledWith(['/watch', 'video-1']);
    });

    it('surfaces an asset upload failure and stops uploading', async () => {
      const component = createComponent();
      component.videoFile = fileWith('tour.mp4', 'video-bytes');

      const submission = component.onSubmit();

      (await awaitRequest('/api/asset')).flush('nope', {
        status: 500,
        statusText: 'Server Error',
      });

      await submission;

      expect(component.error).toBe('Failed to upload file');
      expect(component.uploading).toBe(false);
      expect(component.success).toBe(false);
      expect(videoService.createVideo).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        'Upload error:',
        expect.anything()
      );
    });

    it('surfaces a failure to create the video record', async () => {
      const failure = new Error('record rejected');
      videoService.createVideo.mockReturnValue(throwError(() => failure));

      const component = createComponent();
      component.videoFile = fileWith('tour.mp4', 'video-bytes');

      const submission = component.onSubmit();
      (await awaitRequest('/api/asset')).flush({ id: 'asset-video' });
      await submission;

      expect(component.error).toBe('Failed to create video record');
      expect(component.uploading).toBe(false);
      expect(component.success).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        'Error creating video:',
        failure
      );

      jest.advanceTimersByTime(2000);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  it('returns to the catalog when the upload is cancelled', () => {
    const component = createComponent();

    component.onCancel();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
