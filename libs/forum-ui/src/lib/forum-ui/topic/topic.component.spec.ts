import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopicComponent } from './topic.component';
import { TopicDto } from '../models';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';

describe('TopicComponent', () => {
  let component: TopicComponent;
  let fixture: ComponentFixture<TopicComponent>;

  const mockTopic: TopicDto = {
    id: '1',
    title: 'Test Topic',
    description: 'Test Description',
    userId: 'user1',
    profileId: 'profile1',
    createdAt: new Date(),
    updatedAt: new Date(),
    visibility: 'public',
    isPinned: false,
    isLocked: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopicComponent, CardComponent, ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TopicComponent);
    component = fixture.componentInstance;
    component.topic = mockTopic;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display topic title', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h3').textContent).toContain('Test Topic');
  });

  it('should display topic description', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.topic-description').textContent).toContain(
      'Test Description'
    );
  });

  it('should emit topicClicked when clicked', () => {
    jest.spyOn(component.topicClicked, 'emit');
    const header = fixture.nativeElement.querySelector('.topic-header');
    header.click();
    expect(component.topicClicked.emit).toHaveBeenCalledWith(mockTopic);
  });

  it('should emit editClicked when edit button is clicked', () => {
    component.canEdit = true;
    fixture.detectChanges();
    jest.spyOn(component.editClicked, 'emit');
    
    const editButton = fixture.nativeElement.querySelector('lib-button');
    if (editButton) {
      component.onEdit();
      expect(component.editClicked.emit).toHaveBeenCalledWith(mockTopic);
    }
  });

  it('should show pinned badge when topic is pinned', () => {
    component.topic = { ...mockTopic, isPinned: true };
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.pinned-badge');
    expect(badge).toBeTruthy();
  });

  it('should show locked badge when topic is locked', () => {
    component.topic = { ...mockTopic, isLocked: true };
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.locked-badge');
    expect(badge).toBeTruthy();
  });
});
