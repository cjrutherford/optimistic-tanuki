import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAssistantComponent } from './ai-assistant.component';

/**
 * What the panel tells a reader that the assistant will not.
 *
 * Two things are read from what the tools returned rather than from what the
 * assistant said, for the same reason: its own account is the one source that
 * cannot be trusted to reveal what it missed or did not do.
 */
describe('AiAssistantComponent', () => {
  const component = new AiAssistantComponent();

  describe('when it only saw part of a list', () => {
    it('says so when a tool had more behind it', () => {
      // An answer drawn from the first twenty five of two hundred reads
      // exactly like one drawn from all of them.
      const partial = component.sawOnlyPartOfAList({
        role: 'assistant',
        text: 'Most of them are done.',
        used: [
          {
            tool: 'list_tasks',
            result: '{"count":200,"showing":25,"more":true}',
          },
        ],
      });

      expect(partial).toBe(true);
    });

    it('says so when a result was shortened before it was read', () => {
      const partial = component.sawOnlyPartOfAList({
        role: 'assistant',
        text: 'x',
        used: [
          { tool: 'list_tasks', result: 'list_tasks returned (SHORTENED)' },
        ],
      });

      expect(partial).toBe(true);
    });

    it('stays quiet when the whole list came back', () => {
      const partial = component.sawOnlyPartOfAList({
        role: 'assistant',
        text: 'There are 12 tasks.',
        used: [
          {
            tool: 'list_tasks',
            result: '{"count":12,"showing":12,"more":false}',
          },
        ],
      });

      expect(partial).toBe(false);
    });

    it('stays quiet on a turn that used no tools', () => {
      expect(
        component.sawOnlyPartOfAList({ role: 'assistant', text: 'Hello.' })
      ).toBe(false);
    });
  });

  describe('naming what a tool did', () => {
    it('says it in words rather than as an api call', () => {
      expect(component.describe('create_task')).toBe('proposed a new task');
    });

    it('falls back to something readable for a tool it does not know', () => {
      expect(component.describe('some_new_tool')).toBe('some new tool');
    });

    it('marks a call that only became a proposal', () => {
      expect(component.wasProposed({ result: 'is waiting for approval' })).toBe(
        true
      );
    });
  });

  describe('sending', () => {
    it('will not send while it is already working', () => {
      const busy = new AiAssistantComponent();
      busy.working = true;
      busy.draft = 'a question';
      const asked: string[] = [];
      busy.asked.subscribe((q) => asked.push(q));

      busy.submit();

      expect(asked).toEqual([]);
    });

    it('will not send when there is no assistant to send to', () => {
      const down = new AiAssistantComponent();
      down.unavailable = 'No model is configured.';
      down.draft = 'a question';
      const asked: string[] = [];
      down.asked.subscribe((q) => asked.push(q));

      down.submit();

      expect(asked).toEqual([]);
    });

    it('clears the box once the question is away', () => {
      const ready = new AiAssistantComponent();
      ready.draft = '  a question  ';

      ready.submit();

      expect(ready.draft).toBe('');
    });
  });
  /**
   * Rendered rather than called, on purpose.
   *
   * Every other test here builds the class directly, which is why the tools
   * could stream into an input that the template never read: the input was
   * bound the whole way through and nothing rendered it. A test that asks the
   * component a question cannot catch that. Only the DOM can.
   */
  describe('while it is working', () => {
    let fixture: ComponentFixture<AiAssistantComponent>;

    function text(): string {
      return fixture.nativeElement.textContent ?? '';
    }

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AiAssistantComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(AiAssistantComponent);
      fixture.componentInstance.working = true;
    });

    it('says a run takes a while before any tool has been called', () => {
      fixture.componentInstance.doing = [];
      fixture.detectChanges();

      expect(text()).toContain('This takes a minute');
    });

    it('shows each tool as it is used, in words', () => {
      fixture.componentInstance.doing = ['list_projects', 'count_tasks'];
      fixture.detectChanges();

      const shown = text();
      expect(shown).toContain('looked at your projects');
      expect(shown).toContain('count tasks');
    });

    it('stops promising a wait once there is something to report', () => {
      fixture.componentInstance.doing = ['list_projects'];
      fixture.detectChanges();

      expect(text()).not.toContain('This takes a minute');
    });

    it('shows nothing of the sort when it is not working', () => {
      fixture.componentInstance.working = false;
      fixture.componentInstance.doing = ['list_projects'];
      fixture.detectChanges();

      expect(text()).not.toContain('looked at your projects');
    });
  });
});
