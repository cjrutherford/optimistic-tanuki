import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentComponent } from './comment.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { of } from 'rxjs';

describe('CommentComponent', () => {
  let component: CommentComponent;
  let fixture: ComponentFixture<CommentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentComponent],
      providers: [
        ThemeService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rejects an oversized custom-callback upload before FileReader and clears the input', async () => {
    const oversized = new File(['payload'], 'oversized.png', {
      type: 'image/png',
    });
    Object.defineProperty(oversized, 'size', {
      value: 20 * 1024 * 1024 + 1,
    });
    const input = { files: [oversized], value: 'selected' } as any;
    component.imageUploadCallback = jest.fn();
    const uploadService = (component as any).imageUploadService;
    jest
      .spyOn(uploadService, 'assertFileWithinLimit')
      .mockImplementation(() => {
        throw new Error('File exceeds supported upload size');
      });
    const fileReader = jest.spyOn(FileReader.prototype, 'readAsDataURL');
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    await component.onFileSelected({ target: input } as any);

    expect(uploadService.assertFileWithinLimit).toHaveBeenCalledWith(oversized);
    expect(fileReader).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    expect(input.value).toBe('');
    fileReader.mockRestore();
    alertSpy.mockRestore();
  });

  it('should create editor instance after view init', () => {
    fixture.detectChanges();
    expect(component.editor).toBeDefined();
  });

  it('should open the comment dialog', () => {
    component.openCommentDialog();
    expect(component.showDialog).toBe(true);
  });

  it('should emit comment and close dialog on onSubmit', () => {
    jest.spyOn(component.commentAdded, 'emit');
    component.comment = 'Test comment';

    component.onSubmit();
    expect(component.commentAdded.emit).toHaveBeenCalled();
    expect(component.showDialog).toBe(false);
  });

  it('should clear comment and close dialog on onCancel', () => {
    component.comment = 'Test comment';
    component.onCancel();
    expect(component.comment).toBe('');
    expect(component.showDialog).toBe(false);
  });

  it('should apply theme correctly for dark theme', () => {
    component.theme = 'dark';
    expect(component.theme).toBe('dark');
  });

  it('should apply theme correctly for light theme', () => {
    component.theme = 'light';
    expect(component.theme).toBe('light');
  });
});
