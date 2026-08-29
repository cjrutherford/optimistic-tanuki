import { TimeTrackerComponent, formatDuration } from './time-tracker.component';

/**
 * The clock a person watches while working.
 *
 * It read its inputs once, in ngOnInit, so starting a timer left the component
 * showing what it saw at first render: the button stayed on "Start" and the
 * display never moved. It also showed 00:00:00 for the first second of every
 * timer, and its total ignored the time currently running.
 */
describe('TimeTrackerComponent', () => {
  function componentWith(entries: unknown[]) {
    const component = new TimeTrackerComponent();
    component.taskId = 'task-1';
    component.timeEntries = entries as never;
    component.ngOnChanges();
    return component;
  }

  const minutesAgo = (n: number) =>
    new Date(Date.now() - n * 60_000).toISOString();

  it('notices a timer that started after it was first rendered', () => {
    const component = componentWith([]);
    expect(component.isRunning).toBe(false);

    component.timeEntries = [{ id: 'e1', startTime: minutesAgo(1) }] as never;
    component.ngOnChanges();

    expect(component.isRunning).toBe(true);
    component.ngOnDestroy();
  });

  it('shows the running time immediately rather than after a second', () => {
    // A timer that reads 00:00:00 for its first tick looks broken.
    const component = componentWith([{ id: 'e1', startTime: minutesAgo(2) }]);

    expect(component.displayTime).toBe('00:02:00');
    component.ngOnDestroy();
  });

  it('goes back to nothing when the timer stops', () => {
    const component = componentWith([{ id: 'e1', startTime: minutesAgo(2) }]);

    component.timeEntries = [
      {
        id: 'e1',
        startTime: minutesAgo(2),
        endTime: new Date(),
        elapsedSeconds: 120,
      },
    ] as never;
    component.ngOnChanges();

    expect(component.isRunning).toBe(false);
    expect(component.displayTime).toBe('00:00:00');
  });

  describe('the total', () => {
    it('counts what is running as well as what is finished', () => {
      // Otherwise the total drops the current session and only catches up
      // when the timer stops.
      const component = componentWith([
        {
          id: 'done',
          startTime: minutesAgo(90),
          endTime: new Date(),
          elapsedSeconds: 3600,
        },
        { id: 'now', startTime: minutesAgo(30) },
      ]);

      expect(component.getTotalTimeFormatted()).toBe('1h 30m');
      component.ngOnDestroy();
    });

    it('says so plainly when nothing has been recorded', () => {
      expect(componentWith([]).getTotalTimeFormatted()).toBe('none yet');
    });
  });

  describe('the buttons', () => {
    it('does nothing while a request is in flight', () => {
      // Two starts in a row would open a second entry and stop the first.
      const component = componentWith([]);
      component.busy = true;
      const started: string[] = [];
      component.startTimer.subscribe((id) => started.push(id));

      component.onStartTimer();

      expect(started).toEqual([]);
    });

    it('stops the entry that is actually running', () => {
      const component = componentWith([
        { id: 'older', startTime: minutesAgo(90), endTime: new Date() },
        { id: 'running', startTime: minutesAgo(1) },
      ]);
      const stopped: string[] = [];
      component.stopTimer.subscribe((id) => stopped.push(id));

      component.onStopTimer();

      expect(stopped).toEqual(['running']);
      component.ngOnDestroy();
    });
  });
});

describe('formatDuration', () => {
  it.each([
    [0, 'none yet'],
    [-5, 'none yet'],
    [45, '45s'],
    [600, '10m'],
    [5400, '1h 30m'],
  ])('reads %ss as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
