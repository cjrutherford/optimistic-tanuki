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

  it('accepts video files larger than the previous 500MB client-side limit', () => {
    const largeVideoFile = {
      name: 'large-video.mp4',
      size: 750 * 1024 * 1024,
    } as File;

    component.onVideoFileSelected({
      target: { files: [largeVideoFile] },
    });

    expect(component.videoFile).toBe(largeVideoFile);
    expect(component.error).toBeNull();
  });
});
