import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { Variantable, VariantOptions } from '@optimistic-tanuki/common-ui';
import {
  ThemeColors,
  ThemeVariableService,
} from '@optimistic-tanuki/theme-lib';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { CommunityService } from '../services/community.service';
import {
  CommunityDto,
  CommunityMemberDto,
  CommunityInviteDto,
  InviteToCommunityDto,
  CommunityMemberRole,
} from '../models';

@Component({
  selector: 'lib-manage-members',
  standalone: true,
  providers: [ThemeVariableService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    TextInputComponent,
  ],
  host: {
    '[class.theme]': 'theme',
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-variant]': 'variant',
  },
  templateUrl: './manage-members.component.html',
  styleUrls: ['./manage-members.component.scss'],
})
export class ManageMembersComponent extends Variantable implements OnInit {
  private readonly communityService = inject(CommunityService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  community = signal<CommunityDto | null>(null);
  members = signal<(CommunityMemberDto & { profile?: any })[]>([]);
  pendingRequests = signal<CommunityMemberDto[]>([]);
  pendingInvites = signal<CommunityInviteDto[]>([]);

  loading = signal(false);
  error = signal<string | null>(null);

  inviteControl = new FormControl('');
  currentUserId = '';
  communityId = '';

  activeTab = signal<'members' | 'requests' | 'invites'>('members');

  variant!: string;
  backgroundFilter!: string;
  borderWidth!: string;
  borderRadius!: string;
  borderStyle!: string;
  backgroundGradient!: string;
  svgPattern!: string;
  glowFilter!: string;
  gradientType!: string;
  gradientStops!: string;
  gradientColors!: string;
  animation!: string;
  hoverBoxShadow!: string;
  hoverGradient!: string;
  hoverGlowFilter!: string;
  insetShadow!: string;
  bodyGradient!: string;
  backgroundPattern!: string;

  applyVariant(colors: ThemeColors, options?: VariantOptions): void {
    this.variant = options?.variant || 'default';
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.complementary;
    this.borderGradient =
      this.theme === 'dark'
        ? colors.complementaryGradients?.['dark']
        : colors.complementaryGradients?.['light'];
  }

  override ngOnInit() {
    this.route.data.subscribe((data) => {
      this.currentUserId = data['currentUserId'] || '';
    });

    this.route.params.subscribe((params) => {
      const communitySlug = params['communitySlug'];
      if (communitySlug) {
        this.loadDataBySlug(communitySlug);
      }
    });
  }

  async loadDataBySlug(slug: string) {
    this.loading.set(true);
    try {
      const community = await this.communityService.findBySlug(slug);
      if (!community) {
        this.error.set('Community not found');
        return;
      }
      this.community.set(community);
      this.communityId = community.id;
      await this.loadMembersData();
    } catch (err) {
      console.error('Error loading community data:', err);
      this.error.set('Failed to load community data');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadData() {
    this.loading.set(true);
    try {
      await this.loadMembersData();
    } catch (err) {
      console.error('Error loading community data:', err);
      this.error.set('Failed to load community data');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMembersData() {
    const members = await this.communityService.getMembers(this.communityId);

    const profileIds = [...new Set(members.map((m) => m.profileId))];
    const profilesMap = new Map<string, any>();
    if (profileIds.length > 0) {
      const profiles = await this.communityService.getProfilesByIds(profileIds);
      profiles.forEach((p) => profilesMap.set(p.id, p));
    }

    const membersWithProfiles = members.map((m) => ({
      ...m,
      profile: profilesMap.get(m.profileId),
    }));
    this.members.set(membersWithProfiles);

    const pendingRequests =
      await this.communityService.getPendingJoinRequests(this.communityId);
    this.pendingRequests.set(pendingRequests);

    const pendingInvites = await this.communityService.getPendingInvites(
      this.communityId
    );
    this.pendingInvites.set(pendingInvites);
  }

  isAdmin(): boolean {
    const community = this.community();
    return community?.ownerId === this.currentUserId;
  }

  async approveRequest(member: CommunityMemberDto) {
    try {
      await this.communityService.approveMember(member.id);
      await this.loadData();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to approve member');
    }
  }

  async rejectRequest(member: CommunityMemberDto) {
    if (!confirm('Are you sure you want to reject this request?')) {
      return;
    }

    try {
      await this.communityService.rejectMember(member.id);
      await this.loadData();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to reject member');
    }
  }

  async removeMember(member: CommunityMemberDto) {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      await this.communityService.removeMember(member.id, {
        profileId: member.profileId,
        communityId: this.communityId,
      });
      await this.loadData();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to remove member');
    }
  }

  async cancelInvite(invite: CommunityInviteDto) {
    if (!confirm('Are you sure you want to cancel this invite?')) {
      return;
    }

    try {
      await this.communityService.cancelInvite(invite.id);
      await this.loadData();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to cancel invite');
    }
  }

  async inviteUser() {
    const userId = this.inviteControl.value?.trim();
    if (!userId) {
      this.error.set('Please enter a user ID');
      return;
    }

    try {
      const dto: InviteToCommunityDto = {
        communityId: this.communityId,
        inviteeUserId: userId,
      };
      await this.communityService.invite(dto);
      this.inviteControl.setValue('');
      await this.loadData();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to send invite');
    }
  }

  setTab(tab: 'members' | 'requests' | 'invites') {
    this.activeTab.set(tab);
  }

  getRoleBadgeClass(role: CommunityMemberRole): string {
    switch (role) {
      case CommunityMemberRole.OWNER:
        return 'owner';
      case CommunityMemberRole.ADMIN:
        return 'admin';
      case CommunityMemberRole.MODERATOR:
        return 'moderator';
      default:
        return 'member';
    }
  }

  async appointAsManager(member: CommunityMemberDto & { profile?: any }) {
    if (
      !confirm(
        `Appoint ${member.profile?.profileName || member.profileId
        } as a community manager?`
      )
    ) {
      return;
    }

    try {
      await this.communityService.appointManager(
        this.communityId,
        member.profileId
      );
      await this.loadData();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to appoint manager');
    }
  }

  async revokeManagerRole(member: CommunityMemberDto & { profile?: any }) {
    if (
      !confirm(
        `Revoke manager role from ${member.profile?.profileName || member.profileId
        }?`
      )
    ) {
      return;
    }

    try {
      await this.communityService.revokeManager(
        this.communityId,
        member.profileId
      );
      await this.loadData();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to revoke manager');
    }
  }
}
