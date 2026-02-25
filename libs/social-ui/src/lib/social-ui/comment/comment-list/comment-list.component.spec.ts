import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentListComponent } from './comment-list.component';
import { CommentDto } from '../../../models';
import { PostProfileStub } from '../../post/post.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('CommentListComponent', () => {
  let component: CommentListComponent;
  let fixture: ComponentFixture<CommentListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set comments input', () => {
    const testComments: CommentDto[] = [
      { id: '1', content: 'Test Comment' } as CommentDto,
    ];
    component.comments = testComments;
    fixture.detectChanges();
    expect(component.comments).toEqual(testComments);
  });

  it('should set availableProfiles input', () => {
    const testProfiles: { [key: string]: PostProfileStub } = {
      '1': { id: '1', name: 'User 1', avatar: 'avatar1.jpg' },
    };
    component.availableProfiles = testProfiles;
    fixture.detectChanges();
    expect(component.availableProfiles).toEqual(testProfiles);
  });

  it('should emit commentAdded event when addComment is called', () => {
    jest.spyOn(component.commentAdded, 'emit');
    const content = 'New comment';
    const parentId = 'parent123';
    const postId = 'post456';
    component.addComment(content, parentId, postId);
    expect(component.commentAdded.emit).toHaveBeenCalledWith({
      content,
      parentId,
      postId,
    });
  });

  it('should get profile by id', () => {
    const testProfiles: { [key: string]: PostProfileStub } = {
      '1': { id: '1', name: 'User 1', avatar: 'avatar1.jpg' },
    };
    component.availableProfiles = testProfiles;
    const profile = component.getProfile('1');
    expect(profile).toEqual(testProfiles['1']);
  });
});
