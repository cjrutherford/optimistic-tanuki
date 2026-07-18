import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { UploadComponent } from './upload.component';
import { VideoService } from '../../services/video.service';

describe('UploadComponent', () => {
  let component: UploadComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: VideoService,
          useValue: {
            getChannels: () => of([]),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    component = TestBed.createComponent(UploadComponent).componentInstance;
  });

  it('accepts a video file within the size limit', () => {
    const okVideoFile = {
      name: 'ok-video.mp4',
      size: 750 * 1024 * 1024,
    } as File;

    component.onVideoFileSelected({
      target: { files: [okVideoFile] },
    });

    expect(component.videoFile).toBe(okVideoFile);
    expect(component.error).toBeNull();
  });

  it('rejects a video file that exceeds the size limit', () => {
    const oversizeVideoFile = {
      name: 'huge-video.mp4',
      size: UploadComponent.MAX_VIDEO_FILE_SIZE_BYTES + 1,
    } as File;

    component.onVideoFileSelected({
      target: { files: [oversizeVideoFile] },
    });

    expect(component.videoFile).toBeNull();
    expect(component.error).toContain('too large');
  });
});
