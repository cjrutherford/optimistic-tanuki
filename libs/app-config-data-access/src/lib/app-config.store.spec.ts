import { TestBed } from '@angular/core/testing';
import type {
  AppConfiguration,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { of, Subject, throwError } from 'rxjs';
import { AppConfigApiService } from './app-config-data-access';
import * as dataAccess from '../index';

type AppConfigStore = {
  selected: () => AppConfiguration | null;
  draft: () => UpdateAppConfigDto | null;
  loadError: () => string | null;
  loadByDomain(domain: string): void;
  setDraft(patch: UpdateAppConfigDto): void;
  save(): void;
};

type AppConfigStoreConstructor = new () => AppConfigStore;

const { AppConfigStore } = dataAccess as unknown as {
  AppConfigStore: AppConfigStoreConstructor;
};

describe('AppConfigStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ignores a stale domain response after a newer configuration load starts', () => {
    const firstRequest = new Subject<AppConfiguration>();
    const secondRequest = new Subject<AppConfiguration>();
    const api = {
      getByDomain: jest
        .fn()
        .mockReturnValueOnce(firstRequest)
        .mockReturnValueOnce(secondRequest),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.loadByDomain('first.example');
    store.loadByDomain('second.example');

    secondRequest.next({ id: 'second' } as AppConfiguration);
    firstRequest.next({ id: 'first' } as AppConfiguration);

    expect(store.selected()?.id).toBe('second');
  });

  it('preserves the last valid configuration and exposes a recoverable load error', () => {
    const api = {
      getByDomain: jest
        .fn()
        .mockReturnValue(throwError(() => new Error('network offline'))),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.loadByDomain('north-star.example');

    expect(store.selected()).toBeNull();
    expect(store.loadError()).toBe('network offline');
  });

  it('saves the staged draft and replaces it with the server configuration', () => {
    const saved = {
      id: 'cfg-north-star',
      description: 'Saved description',
    } as AppConfiguration;
    const api = {
      getByDomain: jest.fn().mockReturnValue(of(saved)),
      update: jest.fn().mockReturnValue(of(saved)),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.loadByDomain('north-star.example');
    store.setDraft({ description: 'Saved description' });
    store.save();

    expect(api.update).toHaveBeenCalledWith('cfg-north-star', {
      description: 'Saved description',
    });
    expect(store.selected()).toBe(saved);
    expect(store.draft()).toBeNull();
  });
});
