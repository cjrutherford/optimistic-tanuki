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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set voteState to 1 when upvote is called', () => {
    component.upvote();
    expect(component.voteState).toBe(1);
  });

  it('should set voteState to -1 when downvote is called', () => {
    component.downvote();
    expect(component.voteState).toBe(-1);
  });

  it('should set voteState to 0 when cancelVote is called', () => {
    component.voteState = 1; // Set to a non-zero value first
    component.cancelVote();
    expect(component.voteState).toBe(0);
  });
});