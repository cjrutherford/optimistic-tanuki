import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  HAI_DOCK_SHORTCUTS_STORAGE_KEY,
  HaiDockShortcutStore,
  LocalStorageHaiDockShortcutStore,
} from './hai-dock-shortcut.store';

function createStore(platform: 'browser' | 'server') {
  TestBed.configureTestingModule({
    providers: [{ provide: PLATFORM_ID, useValue: platform }],
  });
  return TestBed.inject(LocalStorageHaiDockShortcutStore);
}

describe('LocalStorageHaiDockShortcutStore', () => {
  beforeEach(() => localStorage.clear());

  it('is the default HaiDockShortcutStore', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    expect(TestBed.inject(HaiDockShortcutStore)).toBeInstanceOf(
      LocalStorageHaiDockShortcutStore
    );
  });

  it('keeps pins under hai-dock-shortcuts:v1 and reads them back', async () => {
    const store = createStore('browser');

    store.set(['fin-commander', 'towne-square']);

    expect(HAI_DOCK_SHORTCUTS_STORAGE_KEY).toBe('hai-dock-shortcuts:v1');
    expect(
      JSON.parse(localStorage.getItem('hai-dock-shortcuts:v1') as string)
    ).toEqual(['fin-commander', 'towne-square']);
    expect(await firstValueFrom(store.observe())).toEqual([
      'fin-commander',
      'towne-square',
    ]);
  });

  it('loads pins saved earlier and drops anything that is not an id', () => {
    localStorage.setItem(
      'hai-dock-shortcuts:v1',
      JSON.stringify(['a', 7, '', 'a', null, 'b'])
    );

    expect(createStore('browser').get()).toEqual(['a', 'b']);
  });

  it('starts empty when the saved value is not valid JSON', () => {
    localStorage.setItem('hai-dock-shortcuts:v1', '{nope');

    expect(createStore('browser').get()).toEqual([]);
  });

  it('emits changes to subscribers', () => {
    const store = createStore('browser');
    const seen: string[][] = [];
    store.observe().subscribe((ids) => seen.push(ids));

    store.set(['a']);
    store.set([]);

    expect(seen).toEqual([[], ['a'], []]);
  });

  it('never touches window or localStorage on the server', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem');
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const store = createStore('server');

    expect(store.get()).toEqual([]);
    store.set(['a']);

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(store.get()).toEqual(['a']);
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
