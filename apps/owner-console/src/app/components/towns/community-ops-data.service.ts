import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  CommunityDto,
  CommunityMemberDto,
  CommunityMemberRole,
} from '@optimistic-tanuki/ui-models';
import { CommunityService } from '../../services/community.service';
import {
  CommunityOpsEntity,
  CommunitySnapshot,
  SummaryMetric,
} from './community-ops.model';

export interface CommunityOpsData {
  entities: CommunityOpsEntity[];
  metrics: SummaryMetric[];
}

export interface OpsAction {
  label: string;
  route: string[];
}

/** Direct actions for an entity; locality pages live under its town. */
export function buildEntityActions(entity: CommunityOpsEntity): OpsAction[] {
  if (entity.entityType === 'community') {
    return [
      {
        label: 'Edit Community',
        route: ['/dashboard/communities', entity.id],
      },
      {
        label: 'Manage Members',
        route: ['/dashboard/communities', entity.id, 'members'],
      },
      ...(['city', 'town'].includes(entity.localityType ?? '')
        ? [
            {
              label: 'Review Boundary',
              route: ['/dashboard/towns', entity.id, 'boundary-review'],
            },
            {
              label: 'Review Business Links',
              route: ['/dashboard/towns', entity.id, 'directory-link-review'],
            },
            {
              label: 'Review Addresses',
              route: [
                '/dashboard/towns',
                entity.id,
                'directory-address-review',
              ],
            },
            {
              label: 'Review Business Identity',
              route: [
                '/dashboard/towns',
                entity.id,
                'directory-identity-review',
              ],
            },
            {
              label: 'Suppress Listings',
              route: [
                '/dashboard/towns',
                entity.id,
                'directory-listing-suppressions',
              ],
            },
            {
              label: 'Listing Reports',
              route: [
                '/dashboard/towns',
                entity.id,
                'directory-listing-reports',
              ],
            },
            {
              label: 'Review Duplicates',
              route: ['/dashboard/towns', entity.id, 'directory-duplicates'],
            },
          ]
        : []),
    ];
  }

  if (entity.entityType === 'city') {
    return [
      { label: 'Edit City', route: ['/dashboard/cities', entity.id] },
      {
        label: 'Review Boundary',
        route: ['/dashboard/towns', entity.id, 'boundary-review'],
      },
      {
        label: 'Review Business Links',
        route: ['/dashboard/towns', entity.id, 'directory-link-review'],
      },
      {
        label: 'Review Addresses',
        route: ['/dashboard/towns', entity.id, 'directory-address-review'],
      },
      {
        label: 'Review Business Identity',
        route: ['/dashboard/towns', entity.id, 'directory-identity-review'],
      },
      {
        label: 'Suppress Listings',
        route: [
          '/dashboard/towns',
          entity.id,
          'directory-listing-suppressions',
        ],
      },
      {
        label: 'Listing Reports',
        route: ['/dashboard/towns', entity.id, 'directory-listing-reports'],
      },
      {
        label: 'Review Duplicates',
        route: ['/dashboard/towns', entity.id, 'directory-duplicates'],
      },
      { label: 'Create Community', route: ['/dashboard/communities/new'] },
    ];
  }

  return [
    {
      label: 'Manage Community Members',
      route: ['/dashboard/communities', entity.communityId ?? '', 'members'],
    },
    {
      label: 'Open Community',
      route: ['/dashboard/communities', entity.communityId ?? ''],
    },
  ];
}

/** Loads communities, cities and members and turns them into ops entities. */
@Injectable({ providedIn: 'root' })
export class CommunityOpsDataService {
  private readonly communityService = inject(CommunityService);

  load(): Observable<CommunityOpsData> {
    return forkJoin({
      communities: this.communityService
        .getCommunities()
        .pipe(catchError(() => of([] as CommunityDto[]))),
      cities: this.communityService
        .getCities()
        .pipe(catchError(() => of([] as CommunityDto[]))),
    })
      .pipe(
        switchMap(({ communities, cities }) => {
          if (communities.length === 0) {
            return of({
              communities,
              cities,
              snapshots: [] as CommunitySnapshot[],
            });
          }

          return forkJoin(
            communities.map((community) =>
              forkJoin({
                members: this.communityService
                  .getCommunityMembers(community.id)
                  .pipe(catchError(() => of([] as CommunityMemberDto[]))),
                manager: this.communityService
                  .getCommunityManager(community.id)
                  .pipe(catchError(() => of(null))),
              }).pipe(
                map(({ members, manager }) => ({
                  community,
                  members,
                  manager,
                }))
              )
            )
          ).pipe(map((snapshots) => ({ communities, cities, snapshots })));
        })
      )
      .pipe(
        map(({ communities, cities, snapshots }) => ({
          entities: this.buildEntities(communities, cities, snapshots),
          metrics: this.buildMetrics(communities, cities, snapshots),
        }))
      );
  }

  buildEntities(
    communities: CommunityDto[],
    cities: CommunityDto[],
    snapshots: CommunitySnapshot[]
  ): CommunityOpsEntity[] {
    const communityEntities: CommunityOpsEntity[] = snapshots.map(
      ({ community, members, manager }) => ({
        id: community.id,
        localityType: community.localityType ?? undefined,
        entityType: 'community' as const,
        title: community.name,
        subtitle: community.description || 'No description provided.',
        detail: manager
          ? `${members.length} member records with ${manager.profileId} assigned as manager.`
          : `${members.length} member records and no assigned community manager.`,
        health: manager ? ('healthy' as const) : ('attention' as const),
        timestamp: community.createdAt,
        route: `/dashboard/communities/${community.id}`,
        memberCount: members.length,
        managerProfileId: manager?.profileId ?? null,
      })
    );

    const cityEntities: CommunityOpsEntity[] = cities.map((city) => ({
      id: city.id,
      entityType: 'city' as const,
      title: city.name,
      subtitle:
        [city.city, city.adminArea].filter(Boolean).join(', ') ||
        'Locality record',
      detail:
        city.population != null
          ? `Population ${city.population.toLocaleString()} with locality type ${
              city.localityType ?? 'city'
            }.`
          : `Locality type ${
              city.localityType ?? 'city'
            } with rollout metadata still forming.`,
      health: city.population ? ('healthy' as const) : ('attention' as const),
      timestamp: city.createdAt,
      route: `/dashboard/cities/${city.id}`,
    }));

    const memberEntities: CommunityOpsEntity[] = snapshots.flatMap(
      ({ community, members, manager }) =>
        members.map((member) => ({
          id: `${community.id}:${member.id}`,
          entityType: 'member' as const,
          title: member.profileId,
          subtitle: `${community.name} member`,
          detail: `${this.formatRole(member.role)} status ${member.status}${
            manager?.profileId === member.profileId
              ? ' and is the assigned manager'
              : ''
          }.`,
          health:
            member.status === 'approved'
              ? ('healthy' as const)
              : ('attention' as const),
          timestamp: member.joinedAt,
          route: `/dashboard/communities/${community.id}/members`,
          communityId: community.id,
          communityName: community.name,
          memberRole: member.role,
          managerProfileId: manager?.profileId ?? null,
        }))
    );

    return [...communityEntities, ...cityEntities, ...memberEntities];
  }

  buildMetrics(
    communities: CommunityDto[],
    cities: CommunityDto[],
    snapshots: CommunitySnapshot[]
  ): SummaryMetric[] {
    const memberCount = snapshots.reduce(
      (sum, snapshot) => sum + snapshot.members.length,
      0
    );
    const communitiesWithoutManager = snapshots.filter(
      (snapshot) => !snapshot.manager
    ).length;
    const pendingMembers = snapshots.reduce(
      (sum, snapshot) =>
        sum +
        snapshot.members.filter((member) => member.status !== 'approved')
          .length,
      0
    );

    return [
      {
        label: 'Communities',
        value: String(communities.length),
        detail: `${communitiesWithoutManager} currently need manager coverage.`,
      },
      {
        label: 'Cities',
        value: String(cities.length),
        detail: 'Locality records currently surfaced through Community Ops.',
      },
      {
        label: 'Member records',
        value: String(memberCount),
        detail: `${pendingMembers} records still need membership intervention.`,
      },
      {
        label: 'Attention entities',
        value: String(
          this.buildEntities(communities, cities, snapshots).filter(
            (entity) => entity.health === 'attention'
          ).length
        ),
        detail: 'Communities, cities, or members that need operator review.',
      },
    ];
  }

  private formatRole(role: CommunityMemberRole): string {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }
}
