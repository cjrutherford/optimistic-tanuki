import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentListComponent } from './comment-list.component';
import { CommentDto } from '../../../models';
import { PostProfileStub } from '../../post/post.component';

describe('CommentListComponent', () => {
  let component: CommentListComponent;
  let fixture: ComponentFixture<CommentListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set comments input', () => {
    const testComments: CommentDto[] = [{ id: '1', content: 'Test Comment' } as CommentDto];
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

  it('should return the correct profile from getProfile', () => {
    const testProfiles: { [key: string]: PostProfileStub } = {
      '1': { id: '1', name: 'User 1', avatar: 'avatar1.jpg' },
      '2': { id: '2', name: 'User 2', avatar: 'avatar2.jpg' },
    };
    component.availableProfiles = testProfiles;
    fixture.detectChanges();
    expect(component.getProfile('1')).toEqual(testProfiles['1']);
    expect(component.getProfile('3')).toBeUndefined();
  });
});