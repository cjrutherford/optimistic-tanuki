import {
  createPerformanceReporter,
  normalizePerformanceRoute,
} from './performance-monitor';

describe('performance monitoring contracts', () => {
  it('normalizes identifiers and numeric route segments without retaining query data', () => {
    expect(
      normalizePerformanceRoute(
        '/projects/123/tasks/550e8400-e29b-41d4-a716-446655440000?tab=all'
      )
    ).toBe('/projects/:id/tasks/:id');
  });

  it('drops invalid samples and flushes valid metrics as one aggregate payload', () => {
    const sent: unknown[] = [];
    const reporter = createPerformanceReporter(
      { appId: 'client-interface', renderMode: 'Client', flushDelayMs: 0 },
      (payload) => sent.push(payload)
    );

    reporter.record({ name: 'lcp', value: 1200 });
    reporter.record({ name: 'inp', value: -1 });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      appId: 'client-interface',
      renderMode: 'Client',
      metrics: [{ name: 'lcp', value: 1200 }],
    });
  });
});
