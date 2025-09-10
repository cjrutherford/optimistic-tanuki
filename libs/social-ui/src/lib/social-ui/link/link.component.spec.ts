import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LinkComponent, LinkType } from './link.component';

describe('LinkComponent', () => {
  let component: LinkComponent;
  let fixture: ComponentFixture<LinkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinkComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LinkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not add link if linkValue is empty', () => {
    component.linkValue = '';
    jest.spyOn(component.linksChange, 'emit');
    component.addLink();
    expect(component.links.length).toBe(0);
    expect(component.linksChange.emit).not.toHaveBeenCalled();
  });

  it('should not add link if linkValue is whitespace', () => {
    component.linkValue = '   ';
    jest.spyOn(component.linksChange, 'emit');
    component.addLink();
    expect(component.links.length).toBe(0);
    expect(component.linksChange.emit).not.toHaveBeenCalled();
  });

  it('should add a link and emit changes', () => {
    const testLink: LinkType = { url: 'http://test.com', title: 'http://test.com' };
    component.linkValue = 'http://test.com';
    jest.spyOn(component.linksChange, 'emit');
    component.addLink();
    expect(component.links).toContainEqual(testLink);
    expect(component.linksChange.emit).toHaveBeenCalledWith({ all: [testLink], added: testLink });
    expect(component.linkValue).toBe('');
  });

  it('should remove a link and emit changes', () => {
    const testLink1: LinkType = { url: 'http://test1.com', title: 'http://test1.com' };
    const testLink2: LinkType = { url: 'http://test2.com', title: 'http://test2.com' };
    component.links = [testLink1, testLink2];
    jest.spyOn(component.linksChange, 'emit');
    component.removeLink(testLink1);
    expect(component.links).not.toContain(testLink1);
    expect(component.links).toContain(testLink2);
    expect(component.linksChange.emit).toHaveBeenCalledWith({ all: [testLink2], removed: testLink1 });
  });

  it('should not remove a link if it does not exist', () => {
    const testLink1: LinkType = { url: 'http://test1.com', title: 'http://test1.com' };
    const nonExistentLink: LinkType = { url: 'http://nonexistent.com', title: 'http://nonexistent.com' };
    component.links = [testLink1];
    jest.spyOn(component.linksChange, 'emit');
    component.removeLink(nonExistentLink);
    expect(component.links).toContain(testLink1);
    expect(component.linksChange.emit).not.toHaveBeenCalled();
  });
});