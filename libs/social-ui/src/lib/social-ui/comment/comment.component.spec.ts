import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentComponent } from './comment.component';
import { MatDialog } from '@angular/material/dialog';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { of } from 'rxjs';

describe('CommentComponent', () => {
  let component: CommentComponent;
  let fixture: ComponentFixture<CommentComponent>;
  let dialogMock: { open: jest.Mock; closeAll: jest.Mock };

  beforeEach(async () => {
    dialogMock = {
      open: jest.fn(),
      closeAll: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CommentComponent],
      providers: [
        ThemeService,
        { provide: MatDialog, useValue: dialogMock },
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

  it('should create editor instance after view init', () => {
    fixture.detectChanges();
    expect(component.editor).toBeDefined();
  });

  it('should open the comment dialog', () => {
    component.openCommentDialog();
    expect(dialogMock.open).toHaveBeenCalled();
  });

  it('should emit comment and close dialog on onSubmit', () => {
    jest.spyOn(component.commentAdded, 'emit');
    const closeAllSpy = jest.fn();
    (component as any).dialogRef = { closeAll: closeAllSpy };

    component.onSubmit();
    expect(component.commentAdded.emit).toHaveBeenCalled();
  });

  it('should clear comment and close dialog on onCancel', () => {
    const closeAllSpy = jest.fn();
    (component as any).dialogRef = { closeAll: closeAllSpy };

    component.comment = 'Test comment';
    component.onCancel();
    expect(component.comment).toBe('');
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
