import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VoteComponent } from './vote.component';

describe('VoteComponent', () => {
  let component: VoteComponent;
  let fixture: ComponentFixture<VoteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoteComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VoteComponent);
    component = fixture.componentInstance;
    component.postId = 'test-post';
    component.userId = 'test-user';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit voteChanged with value 1 when upvote is called', () => {
    const emitSpy = jest.spyOn(component.voteChanged, 'emit');
    component.upvote();
    expect(emitSpy).toHaveBeenCalledWith({ postId: 'test-post', value: 1 });
  });

  it('should emit voteChanged with value -1 when downvote is called', () => {
    const emitSpy = jest.spyOn(component.voteChanged, 'emit');
    component.downvote();
    expect(emitSpy).toHaveBeenCalledWith({ postId: 'test-post', value: -1 });
  });

  it('should toggle upvote off when already upvoted', () => {
    component.currentVote = 1;
    const emitSpy = jest.spyOn(component.voteChanged, 'emit');
    component.upvote();
    expect(emitSpy).toHaveBeenCalledWith({ postId: 'test-post', value: 0 });
  });
});
