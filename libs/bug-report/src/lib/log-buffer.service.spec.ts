import { LogBufferService } from './log-buffer.service';

describe('LogBufferService', () => {
  let svc: LogBufferService;

  beforeEach(() => {
    svc = new LogBufferService();
    svc.clear();
  });

  afterEach(() => svc.stop());

  it('captures console.error output', () => {
    svc.start();
    console.error('boom-x');
    expect(svc.getSnapshot().some((l) => l.includes('boom-x'))).toBe(true);
  });

  it('caps buffer at 200 entries', () => {
    svc.start();
    for (let i = 0; i < 250; i++) console.log(`line-${i}`);
    expect(svc.getSnapshot()).toHaveLength(200);
    expect(svc.getSnapshot()[199]).toContain('line-249');
  });

  it('records backend trace ids up to 20', () => {
    for (let i = 0; i < 25; i++) svc.addTraceId(`req-${i}`);
    expect(svc.getTraceIds()).toHaveLength(20);
    expect(svc.getTraceIds()[19]).toBe('req-24');
  });
});
