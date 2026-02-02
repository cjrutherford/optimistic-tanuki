import { TestBed } from '@angular/core/testing';
import { ComponentEventBusService } from './component-event-bus.service';
import { ComponentEvent } from '../../types/event-types';

describe('ComponentEventBusService', () => {
  let service: ComponentEventBusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ComponentEventBusService],
    });
    service = TestBed.inject(ComponentEventBusService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('publish', () => {
    it('should publish an event', (done) => {
      const testEvent: ComponentEvent = {
        type: 'component:inserted',
        instanceId: 'test-123',
        componentId: 'test-component',
        timestamp: Date.now(),
      };

      service.subscribe((event) => {
        expect(event).toEqual(testEvent);
        done();
      });

      service.publish(testEvent);
    });

    it('should publish multiple events', () => {
      const events: ComponentEvent[] = [];
      
      service.subscribe((event) => {
        events.push(event);
      });

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });

      service.publish({
        type: 'component:updated',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
        changes: {},
      });

      expect(events.length).toBe(2);
      expect(events[0].type).toBe('component:inserted');
      expect(events[1].type).toBe('component:updated');
    });

    it('should update statistics when publishing', () => {
      service.publish({
        type: 'component:inserted',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });

      const stats = service.getStats();
      expect(stats.totalPublished).toBe(1);
      expect(stats.eventsByType['component:inserted']).toBe(1);
    });
  });

  describe('subscribe', () => {
    it('should return a subscription', () => {
      const subscription = service.subscribe(() => {});
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should allow unsubscribe', () => {
      let callCount = 0;
      
      const subscription = service.subscribe(() => {
        callCount++;
      });

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });

      expect(callCount).toBe(1);

      subscription.unsubscribe();

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-2',
        componentId: 'comp-2',
        timestamp: Date.now(),
      });

      expect(callCount).toBe(1); // Should not increase
    });

    it('should track subscriber count', () => {
      const sub1 = service.subscribe(() => {});
      expect(service.getStats().subscriberCount).toBe(1);

      const sub2 = service.subscribe(() => {});
      expect(service.getStats().subscriberCount).toBe(2);

      sub1.unsubscribe();
      expect(service.getStats().subscriberCount).toBe(1);

      sub2.unsubscribe();
      expect(service.getStats().subscriberCount).toBe(0);
    });
  });

  describe('subscribeToType', () => {
    it('should only receive events of specified type', () => {
      const receivedEvents: ComponentEvent[] = [];

      service.subscribeToType('component:inserted', (event) => {
        receivedEvents.push(event);
      });

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });

      service.publish({
        type: 'component:updated',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
        changes: {},
      });

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-2',
        componentId: 'comp-2',
        timestamp: Date.now(),
      });

      expect(receivedEvents.length).toBe(2);
      expect(receivedEvents[0].type).toBe('component:inserted');
      expect(receivedEvents[1].type).toBe('component:inserted');
    });

    it('should provide type-narrowed events', (done) => {
      service.subscribeToType('component:updated', (event) => {
        // TypeScript should know this is ComponentUpdatedEvent
        expect(event.type).toBe('component:updated');
        expect(event.changes).toBeDefined();
        done();
      });

      service.publish({
        type: 'component:updated',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
        changes: { data: { prop: 'value' } },
      });
    });
  });

  describe('subscribeWithFilter', () => {
    it('should only receive events matching filter', () => {
      const receivedEvents: ComponentEvent[] = [];

      service.subscribeWithFilter(
        (event) => event.instanceId === 'test-1',
        (event) => {
          receivedEvents.push(event);
        }
      );

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-2',
        componentId: 'comp-2',
        timestamp: Date.now(),
      });

      service.publish({
        type: 'component:updated',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
        changes: {},
      });

      expect(receivedEvents.length).toBe(2);
      expect(receivedEvents[0].instanceId).toBe('test-1');
      expect(receivedEvents[1].instanceId).toBe('test-1');
    });
  });

  describe('ofType', () => {
    it('should return Observable of specific event type', (done) => {
      service.ofType('component:removed').subscribe((event) => {
        expect(event.type).toBe('component:removed');
        expect(event.instanceId).toBe('test-1');
        done();
      });

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-2',
        componentId: 'comp-2',
        timestamp: Date.now(),
      });

      service.publish({
        type: 'component:removed',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no events published', () => {
      const history = service.getHistory();
      expect(history).toEqual([]);
    });

    it('should store event history', () => {
      service.publish({
        type: 'component:inserted',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });

      service.publish({
        type: 'component:updated',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
        changes: {},
      });

      const history = service.getHistory();
      expect(history.length).toBe(2);
    });

    it('should limit history size', () => {
      // Publish more than max size (100)
      for (let i = 0; i < 150; i++) {
        service.publish({
          type: 'component:inserted',
          instanceId: `test-${i}`,
          componentId: 'comp-1',
          timestamp: Date.now(),
        });
      }

      const history = service.getHistory();
      expect(history.length).toBe(100);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 50; i++) {
        service.publish({
          type: 'component:inserted',
          instanceId: `test-${i}`,
          componentId: 'comp-1',
          timestamp: Date.now(),
        });
      }

      const history = service.getHistory(10);
      expect(history.length).toBe(10);
    });
  });

  describe('getHistoryByType', () => {
    it('should return only events of specified type', () => {
      service.publish({
        type: 'component:inserted',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });

      service.publish({
        type: 'component:updated',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
        changes: {},
      });

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-2',
        componentId: 'comp-2',
        timestamp: Date.now(),
      });

      const history = service.getHistoryByType('component:inserted');
      expect(history.length).toBe(2);
      expect(history[0].type).toBe('component:inserted');
      expect(history[1].type).toBe('component:inserted');
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 20; i++) {
        service.publish({
          type: 'component:inserted',
          instanceId: `test-${i}`,
          componentId: 'comp-1',
          timestamp: Date.now(),
        });
      }

      const history = service.getHistoryByType('component:inserted', 5);
      expect(history.length).toBe(5);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = service.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalPublished).toBe(0);
      expect(stats.eventsByType).toEqual({});
      expect(stats.subscriberCount).toBe(0);
    });

    it('should track events by type', () => {
      service.publish({
        type: 'component:inserted',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-2',
        componentId: 'comp-2',
        timestamp: Date.now(),
      });

      service.publish({
        type: 'component:updated',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
        changes: {},
      });

      const stats = service.getStats();
      expect(stats.totalPublished).toBe(3);
      expect(stats.eventsByType['component:inserted']).toBe(2);
      expect(stats.eventsByType['component:updated']).toBe(1);
    });
  });

  describe('ngOnDestroy', () => {
    it('should complete events$ observable', (done) => {
      service.events$.subscribe({
        complete: () => {
          done();
        },
      });

      service.ngOnDestroy();
    });

    it('should prevent new events after destroy', () => {
      let eventCount = 0;

      service.subscribe(() => {
        eventCount++;
      });

      service.ngOnDestroy();

      service.publish({
        type: 'component:inserted',
        instanceId: 'test-1',
        componentId: 'comp-1',
        timestamp: Date.now(),
      });

      expect(eventCount).toBe(0);
    });
  });
});
