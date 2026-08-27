import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CodeDraftStore } from './code-draft.store';

describe('CodeDraftStore', () => {
  describe('in the browser', () => {
    let store: CodeDraftStore;

    beforeEach(() => {
      localStorage.clear();
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
      });
      store = TestBed.inject(CodeDraftStore);
    });

    it('has no draft for an exercise nobody has touched', () => {
      expect(store.read('go-b-01')).toBeNull();
    });

    it('reads back what it wrote', () => {
      store.write('go-b-01', 'package main');
      expect(store.read('go-b-01')).toBe('package main');
    });

    it('keeps drafts for different exercises apart', () => {
      store.write('go-b-01', 'first');
      store.write('go-b-02', 'second');

      expect(store.read('go-b-01')).toBe('first');
      expect(store.read('go-b-02')).toBe('second');
    });

    it('namespaces its keys so it cannot collide with other apps', () => {
      store.write('go-b-01', 'x');
      const keys = Object.keys(localStorage);

      expect(keys).toHaveLength(1);
      expect(keys[0]).toContain('learning:');
    });

    it('forgets a draft on clear', () => {
      store.write('go-b-01', 'x');
      store.clear('go-b-01');

      expect(store.read('go-b-01')).toBeNull();
    });

    // Private browsing and blocked storage both throw on access. Losing a
    // draft is acceptable; breaking the lesson is not.
    it('survives storage that throws', () => {
      const boom = () => {
        throw new Error('blocked');
      };
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);

      expect(() => store.write('go-b-01', 'x')).not.toThrow();
      expect(store.read('go-b-01')).toBeNull();
      expect(() => store.clear('go-b-01')).not.toThrow();

      jest.restoreAllMocks();
    });
  });

  describe('on the server', () => {
    let store: CodeDraftStore;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      });
      store = TestBed.inject(CodeDraftStore);
    });

    it('reads nothing and writes nothing', () => {
      const setItem = jest.spyOn(Storage.prototype, 'setItem');

      store.write('go-b-01', 'package main');

      expect(store.read('go-b-01')).toBeNull();
      expect(setItem).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });
});
