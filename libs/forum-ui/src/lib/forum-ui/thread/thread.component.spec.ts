import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThreadComponent } from './thread.component';
import { ThreadDto } from '../models';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';

describe('ThreadComponent', () => {
  let component: ThreadComponent;
  let fixture: ComponentFixture<ThreadComponent>;

  const mockThread: ThreadDto = {
    id: '1',
    title: 'Test Thread',
    description: 'Test Content',
    userId: 'user1',
    profileId: 'profile1',
    topicId: 'topic1',
    createdAt: new Date(),
    updatedAt: new Date(),
    visibility: 'public',
    isPinned: false,
    isLocked: false,
    viewCount: 42,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreadComponent, CardComponent, ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ThreadComponent);
    component = fixture.componentInstance;
    component.thread = mockThread;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display thread title', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h4').textContent).toContain('Test Thread');
  });

  it('should display thread content', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.thread-content').textContent).toContain(
      'Test Content'
    );
  });

  it('should display view count', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('42 views');
  });

  it('should emit threadClicked when clicked', () => {
    jest.spyOn(component.threadClicked, 'emit');
    const header = fixture.nativeElement.querySelector('.thread-header');
    header.click();
    expect(component.threadClicked.emit).toHaveBeenCalledWith(mockThread);
  });
});
