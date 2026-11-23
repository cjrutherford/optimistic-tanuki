import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import { ControlCenterService } from '../services/control-center.service';
import { AdminControlCenterComponent } from './admin-control-center.component';
import {
  createOwnerConfirmStub,
  OwnerConfirmStub,
} from './owner-confirm.testing';

interface ControlCenterStub {
  getPublicStatus: jest.Mock;
  getLatestRollout: jest.Mock;
  getRolloutHistory: jest.Mock;
  getOAuthProviders: jest.Mock;
  getRolloutPreview: jest.Mock;
  startRollout: jest.Mock;
}

describe('AdminControlCenterComponent', () => {
  let service: ControlCenterStub;
  let confirmStub: OwnerConfirmStub;

  beforeEach(async () => {
    service = {
      getPublicStatus: jest.fn().mockReturnValue(
        of({
          deploymentName: 'prod',
          namespace: 'ns',
          provider: 'k8s',
          defaultTag: 'v1',
        })
      ),
      getLatestRollout: jest.fn().mockReturnValue(of(null)),
      getRolloutHistory: jest.fn().mockReturnValue(of([])),
      getOAuthProviders: jest.fn().mockReturnValue(of({ providers: [] })),
      getRolloutPreview: jest
        .fn()
        .mockReturnValue(of({ strategy: 's', services: [], waves: [] })),
      startRollout: jest.fn().mockReturnValue(of({ status: 'running' })),
    };
    confirmStub = createOwnerConfirmStub();
    await TestBed.configureTestingModule({
      imports: [AdminControlCenterComponent],
      providers: [
        { provide: ControlCenterService, useValue: service },
        { provide: OwnerConfirmService, useValue: confirmStub },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(AdminControlCenterComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('has a page header and no hero banner', () => {
    const el = create().nativeElement as HTMLElement;
    expect(el.querySelector('.hero')).toBeNull();
    expect(el.querySelector('ot-owner-page-header')).not.toBeNull();
  });

  it('shows an error with retry when history fails to load', () => {
    service.getRolloutHistory.mockReturnValue(throwError(() => new Error('x')));
    const fixture = create();
    const component = fixture.componentInstance;
    expect(component.historyError()).toBe('Could not load rollout history.');

    service.getRolloutHistory.mockReturnValue(of([]));
    component.loadHistory();
    expect(component.historyError()).toBeNull();
  });

  it('shows an error with retry when status or providers fail', () => {
    service.getPublicStatus.mockReturnValue(throwError(() => new Error('x')));
    service.getOAuthProviders.mockReturnValue(throwError(() => new Error('x')));
    const component = create().componentInstance;
    expect(component.statusError()).not.toBeNull();
    expect(component.providersError()).not.toBeNull();
  });

  it('treats the no-rollout reply as nothing to show', () => {
    // The API answers `{ status: 'pending' }` alone when no rollout has run.
    service.getLatestRollout.mockReturnValue(of({ status: 'pending' }));
    const fixture = create();
    expect(fixture.componentInstance.latestRollout()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Latest rollout'
    );
  });

  it('shows an error with retry when the rollout plan fails to load', () => {
    service.getRolloutPreview.mockReturnValue(throwError(() => new Error('x')));
    const fixture = create();
    const component = fixture.componentInstance;
    expect(component.rolloutError()).toBe('Could not load the rollout plan.');

    service.getRolloutPreview.mockReturnValue(
      of({ strategy: 's', services: [], waves: [] })
    );
    component.refreshRollout();
    expect(component.rolloutError()).toBeNull();
  });

  it('reports a rollout that could not be started', async () => {
    service.startRollout.mockReturnValue(throwError(() => new Error('x')));
    const component = create().componentInstance;
    await component.startRollout();
    expect(component.rolloutError()).toBe('The rollout could not be started.');
  });

  it('deploys only after typing the tag', async () => {
    const component = create().componentInstance;
    await component.startRollout();
    expect(confirmStub.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'typed', typedPhrase: 'v1' })
    );
    expect(service.startRollout).toHaveBeenCalledWith('v1');
  });

  it('does not deploy when the confirmation is declined', async () => {
    confirmStub.confirm.mockResolvedValue({ confirmed: false });
    const component = create().componentInstance;
    await component.startRollout();
    expect(service.startRollout).not.toHaveBeenCalled();
  });
});
