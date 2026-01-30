import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentsComponent } from './comments.component';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  CommentListComponent,
  ComposeComponent,
  PostData,
} from '@optimistic-tanuki/social-ui';
import { CommentDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'lib-social-compose',
  standalone: true,
  template: '',
})
class MockComposeComponent {
  @Output() postSubmitted = new EventEmitter<PostData>();
}

@Component({
  selector: 'lib-comment-list',
  standalone: true,
  template: '',
})
class MockCommentListComponent {
  @Input() comments: CommentDto[] = [];
  @Output() commentAdded = new EventEmitter<{
    content: string;
    parentId: string;
    postId: string;
  }>();
}

describe('CommentsComponent', () => {
  let component: CommentsComponent;
  let fixture: ComponentFixture<CommentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentsComponent],
    })
      .overrideComponent(CommentsComponent, {
        remove: { imports: [ComposeComponent, CommentListComponent] },
        add: { imports: [MockComposeComponent, MockCommentListComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CommentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
