import { ProjectSummaryComponent } from './project-summary.component';

/**
 * The two presentation rules that came out of looking at the rendered panel.
 *
 * Both were only visible on screen. The model name overflowed its line, and
 * every concern named its task three times: in the heading, in the sentence,
 * and again in the citation underneath.
 */
describe('ProjectSummaryComponent presentation', () => {
  function componentWith(model: string | null) {
    const component = new ProjectSummaryComponent();
    component.project = {
      id: 'p1',
      tasks: [{ id: 't-uuid', title: 'Book the crane for lift-in' }],
      risks: [{ id: 'r-uuid', description: 'Crane availability' }],
    } as never;
    component.narrative = { summary: null, model, discarded: 0 };
    return component;
  }

  describe('the model name', () => {
    it('shows something readable rather than a registry path', () => {
      const component = componentWith(
        'hf.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF:Q4_K_M'
      );

      expect(component.modelLabel).toBe('DeepSeek-R1-Distill-Qwen-7B');
    });

    it('leaves a plain name alone', () => {
      expect(componentWith('qwen3:8b').modelLabel).toBe('qwen3');
    });

    it('copes with no model at all', () => {
      expect(componentWith(null).modelLabel).toBe('');
    });
  });

  describe('the citation under a concern', () => {
    it('is hidden when the concern already names what it came from', () => {
      const component = componentWith('m');

      expect(
        component.showsEvidence({
          about: 'Book the crane for lift-in has no assignee',
          evidenceId: 't-uuid',
        })
      ).toBe(false);
    });

    it('is shown when the concern does not name it', () => {
      const component = componentWith('m');

      expect(
        component.showsEvidence({
          about: 'Nobody is assigned to the lift',
          evidenceId: 't-uuid',
        })
      ).toBe(true);
    });
  });

  describe('resolving an id to something a reader recognises', () => {
    it('uses a task title', () => {
      expect(componentWith('m').evidenceFor('t-uuid')).toBe(
        'Book the crane for lift-in'
      );
    });

    it('uses a risk description, since risks carry no title', () => {
      expect(componentWith('m').evidenceFor('r-uuid')).toBe(
        'Crane availability'
      );
    });

    it('falls back to the id rather than showing nothing', () => {
      expect(componentWith('m').evidenceFor('unknown')).toBe('unknown');
    });
  });
});
