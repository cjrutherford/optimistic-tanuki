import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactionComponent, REACTIONS } from './reaction.component';

describe('ReactionComponent', () => {
  let component: ReactionComponent;
  let fixture: ComponentFixture<ReactionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReactionComponent);
    component = fixture.componentInstance;
    component.postId = 'post-1';
    fixture.detectChanges();
  });

  it('toggles the picker open and closed', () => {
    component.togglePicker();
    expect(component.showPicker).toBe(true);

    component.togglePicker();
    expect(component.showPicker).toBe(false);
  });

  it('closes the picker without reopening it', () => {
    component.showPicker = true;

    component.closePicker();

    expect(component.showPicker).toBe(false);
  });

  it('resolves the emoji for the current reaction', () => {
    component.currentReaction = 2;

    expect(component.currentReactionEmoji).toBe('😂');
  });

  it('falls back to a neutral emoji for an unknown reaction value', () => {
    component.currentReaction = 99;

    expect(component.currentReactionEmoji).toBe('😀');
  });

  it('sums every reaction count', () => {
    component.reactionCounts = { 1: 3, 2: 4, 5: 1 };

    expect(component.totalReactions).toBe(8);
  });

  it('reports zero when nothing has been reacted with', () => {
    expect(component.totalReactions).toBe(0);
    expect(component.getCountForReaction(1)).toBe(0);
  });

  it('lists only reacted emoji, ordered by descending count', () => {
    component.reactionCounts = { 1: 2, 3: 7, 4: 0, 5: 5 };

    expect(
      component.reactionsWithCounts.map((r) => [r.reaction.value, r.count])
    ).toEqual([
      [3, 7],
      [5, 5],
      [1, 2],
    ]);
  });

  it('emits the selected reaction with the post id and closes the picker', () => {
    const emitted: { postId: string; value: number }[] = [];
    component.reactionSelected.subscribe((e) => emitted.push(e));
    component.showPicker = true;

    component.selectReaction(5);

    expect(emitted).toEqual([{ postId: 'post-1', value: 5 }]);
    expect(component.showPicker).toBe(false);
  });

  it('shows the add-reaction affordance when there are no reactions', () => {
    expect(fixture.nativeElement.querySelector('.add-reaction')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.reaction-summary')).toBeNull();
  });

  it('renders a summary chip per reacted emoji and marks the user selection', () => {
    component.reactionCounts = { 1: 2, 3: 1 };
    component.currentReaction = 1;
    fixture.detectChanges();

    const chips: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.reaction-item')
    );

    expect(chips).toHaveLength(2);
    expect(chips[0].textContent).toContain('❤️');
    expect(chips[0].classList.contains('selected')).toBe(true);
  });

  it('collapses to a single current-reaction badge when the summary is disabled', () => {
    component.reactionCounts = { 2: 4 };
    component.currentReaction = 2;
    component.showSummary = false;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.current-reaction').textContent
    ).toContain('😂');
    expect(
      fixture.nativeElement.querySelector('.reaction-count').textContent
    ).toContain('4');
  });

  it('opens the picker on container click and emits from a picker button', () => {
    const emitted: { postId: string; value: number }[] = [];
    component.reactionSelected.subscribe((e) => emitted.push(e));

    fixture.nativeElement.querySelector('.reaction-container').click();
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.reaction-btn')
    );
    expect(buttons).toHaveLength(REACTIONS.length);

    buttons[0].click();

    expect(emitted).toEqual([{ postId: 'post-1', value: 1 }]);
  });

  it('shows a count badge on picker buttons that already have reactions', () => {
    component.reactionCounts = { 1: 9 };
    component.showPicker = true;
    fixture.detectChanges();

    const badges: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.count-badge')
    );

    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toContain('9');
  });
});
