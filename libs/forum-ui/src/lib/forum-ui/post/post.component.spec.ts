import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForumPostComponent } from './post.component';
import { ForumPostDto } from '../models';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';

describe('ForumPostComponent', () => {
  let component: ForumPostComponent;
  let fixture: ComponentFixture<ForumPostComponent>;

  const mockPost: ForumPostDto = {
    id: '1',
    content: 'Test post content',
    userId: 'user1',
    profileId: 'profile1',
    threadId: 'thread1',
    createdAt: new Date(),
    updatedAt: new Date(),
    isEdited: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForumPostComponent, CardComponent, ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ForumPostComponent);
    component = fixture.componentInstance;
    component.post = mockPost;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display post content', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.post-content').textContent).toContain(
      'Test post content'
    );
  });

  it('should show edited badge when post is edited', () => {
    component.post = { ...mockPost, isEdited: true };
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.edited-badge');
    expect(badge).toBeTruthy();
  });

  it('should emit editClicked when edit button is clicked', () => {
    component.canEdit = true;
    fixture.detectChanges();
    jest.spyOn(component.editClicked, 'emit');
    component.onEdit();
    expect(component.editClicked.emit).toHaveBeenCalledWith(mockPost);
  });
});
