import { AssistantContextService } from './assistant-context.service';

/**
 * Which project the assistant is on.
 *
 * It used to live on the projects page, which is where a project id comes
 * from. Reachable everywhere, the project has to travel to it instead, and a
 * stale one would have it act on something nobody named.
 */
describe('AssistantContextService', () => {
  it('starts on no project, which is a valid place to start', () => {
    expect(new AssistantContextService().project()).toBeNull();
  });

  it('remembers the project a page put it on', () => {
    const context = new AssistantContextService();

    context.working({ id: 'p1', name: 'Kiln rebuild' });

    expect(context.project()).toEqual({ id: 'p1', name: 'Kiln rebuild' });
  });

  it('goes back to none when a page says there is none', () => {
    // Deselecting a project must not leave the assistant acting on the last
    // one somebody happened to look at.
    const context = new AssistantContextService();
    context.working({ id: 'p1', name: 'Kiln rebuild' });

    context.working(null);

    expect(context.project()).toBeNull();
  });

  it('clears', () => {
    const context = new AssistantContextService();
    context.working({ id: 'p1', name: 'Kiln rebuild' });

    context.clear();

    expect(context.project()).toBeNull();
  });
});
