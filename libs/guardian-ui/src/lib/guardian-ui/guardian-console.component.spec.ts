import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { GuardianConsoleComponent } from './guardian-console.component';

describe('GuardianConsoleComponent', () => {
  const dependentA = {
    dependentUserId: 'teen-a',
    profileId: 'profile-a',
    profileName: 'Teen A',
    profilePic: '',
    coverPic: '',
    status: 'approved' as const,
  };
  const dependentB = {
    dependentUserId: 'teen-b',
    profileId: 'profile-b',
    profileName: 'Teen B',
    profilePic: '',
    coverPic: '',
    status: 'approved' as const,
  };

  it('clears the prior dependent and ignores late responses after selection changes', async () => {
    const pending: Array<(value: any) => void> = [];
    const http = {
      get: jest.fn((url: string) => {
        if (url.includes('profile-a'))
          return new Observable((subscriber) => {
            pending.push((value) => {
              subscriber.next(value);
              subscriber.complete();
            });
          });
        if (url.includes('profile-b')) {
          if (url.includes('/api/profile/dependents/'))
            return of({ id: 'profile-b', profileName: 'Teen B' });
          if (url.endsWith('/posts'))
            return of([
              { id: 'post-b', title: 'B only', content: 'B content' },
            ]);
          return of([{ id: 'asset-b', name: 'B media' }]);
        }
        return of([]);
      }),
    };
    TestBed.configureTestingModule({
      imports: [GuardianConsoleComponent],
      providers: [{ provide: HttpClient, useValue: http }],
    });
    const component = TestBed.createComponent(
      GuardianConsoleComponent
    ).componentInstance;
    component.dependents = [dependentA, dependentB];
    const first = component.selectDependent(dependentA);
    expect(component.posts).toEqual([]);
    expect(component.assets).toEqual([]);
    await component.selectDependent(dependentB);
    pending.forEach((resolve) =>
      resolve({ id: 'profile-a', profileName: 'Teen A' })
    );
    await first;
    expect(component.selected?.profileId).toBe('profile-b');
    expect(component.profile?.profileName).toBe('Teen B');
    expect(component.posts.map((post) => post.title)).toEqual(['B only']);
    expect(component.assets.map((asset) => asset.name)).toEqual(['B media']);
  });

  it('sends only delegated profile fields from the shared profile editor', async () => {
    const http = {
      put: jest.fn(() =>
        of({ id: 'profile-a', profileName: 'Updated Teen A' })
      ),
    };
    TestBed.configureTestingModule({
      imports: [GuardianConsoleComponent],
      providers: [{ provide: HttpClient, useValue: http }],
    });
    const component = TestBed.createComponent(
      GuardianConsoleComponent
    ).componentInstance;
    component.selected = dependentA;

    await component.saveProfile({
      id: 'profile-a',
      name: 'Updated Teen A',
      description: 'editor-only field',
      profilePic: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
    } as never);

    expect(http.put).toHaveBeenCalledWith('/api/profile/dependents/profile-a', {
      name: 'Updated Teen A',
      profilePic: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
    });
    expect(component.profile?.profileName).toBe('Updated Teen A');
  });
});
