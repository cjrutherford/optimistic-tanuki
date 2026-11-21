import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { SearchService } from '@optimistic-tanuki/search-ui';
import { firstValueFrom } from 'rxjs';
import { ValidationBoardComponent } from './validation-board.component';

describe('Validation board', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidationBoardComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    }).compileComponents();
  });

  it('presents representative library surfaces and editable form controls', async () => {
    const fixture = TestBed.createComponent(ValidationBoardComponent);
    fixture.detectChanges();
    const board: HTMLElement = fixture.nativeElement;
    expect(board.querySelector('#common-ui')?.textContent).toContain('Primary');
    expect(board.querySelector('#form-ui')?.textContent).toContain(
      'Workspace name'
    );
    expect(
      board.querySelector('#search-ui search-global-search')
    ).not.toBeNull();
    const input = board.querySelector<HTMLInputElement>('#form-ui input')!;
    input.value = 'Design review';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.workspaceName).toBe('Design review');
  });

  it('seeds helpful guidance once without replacing existing messages', () => {
    const service = TestBed.inject(MessageService);
    TestBed.createComponent(ValidationBoardComponent);
    expect(service.messages().map((message) => message.content)).toEqual([
      'Validation board loaded.',
      'Switch personalities from the global toolbar.',
    ]);
    TestBed.createComponent(ValidationBoardComponent);
    expect(service.messages()).toHaveLength(2);
  });

  it('provides case-insensitive search against the board sample data', async () => {
    const fixture = TestBed.createComponent(ValidationBoardComponent);
    const search = fixture.debugElement.injector.get(SearchService);
    const matches = await firstValueFrom(search.search('ARI'));
    expect(matches.users.map((user) => user.title)).toEqual(['Ari Stone']);
    expect(matches.posts).toEqual([]);
    const absent = await firstValueFrom(search.search('not present'));
    expect(absent.users).toEqual([]);
    expect(absent.posts).toEqual([]);
  });
});
