import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ClassifiedService, ClassifiedAd } from '../../services/classified.service';
import { CommunityService, LocalCommunity } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-classifieds',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './classifieds.component.html',
  styleUrls: ['./classifieds.component.scss'],
})
export class ClassifiedsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private classifiedService = inject(ClassifiedService);
  private communityService = inject(CommunityService);
  private authState = inject(AuthStateService);

  community = signal<LocalCommunity | null>(null);
  classifieds = signal<ClassifiedAd[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  isAuthenticated = signal(false);
  isMember = signal(false);

  ngOnInit(): void {
    this.authState.isAuthenticated$.subscribe((auth) => {
      this.isAuthenticated.set(auth);
    });

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.loadData(slug);
  }

  async loadData(slug: string): Promise<void> {
    try {
      const [community, classifieds] = await Promise.all([
        this.communityService.getCommunityBySlug(slug),
        this.classifiedService.getClassifieds(slug),
      ]);
      this.community.set(community);
      this.classifieds.set(classifieds);

      if (this.isAuthenticated()) {
        try {
          const member = await this.communityService.isMember(community.id);
          this.isMember.set(member);
        } catch {
          // non-fatal
        }
      }
    } catch {
      this.error.set('Unable to load classifieds. Please try again later.');
    } finally {
      this.loading.set(false);
    }
  }

  navigateToCommunity(): void {
    const slug = this.community()?.slug;
    if (slug) {
      this.router.navigate(['/c', slug]);
    }
  }

  promptSignIn(action: string): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url, action },
    });
  }

  promptPostClassified(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('post-classified');
      return;
    }
    if (!this.isMember()) {
      // TODO: show join-community modal
      alert('Please join this community first to post a classified.');
      return;
    }
    // TODO: navigate to create classified form (Phase 3)
    alert('Create classified — coming in Phase 3!');
  }

  promptContactSeller(classified: ClassifiedAd): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('contact-seller');
      return;
    }
    if (!this.isMember()) {
      alert('Please join this community first to contact sellers.');
      return;
    }
    // TODO: open buyer/seller chat (Phase 3)
    alert(`Contacting seller for: "${classified.title}" — coming in Phase 3!`);
  }
}
