import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { LeadsService } from './leads.service';
import { Topic } from './leads.types';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
    selector: 'app-topics',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './topics.component.html',
    styleUrl: './topics.component.scss',
})
export class TopicsComponent implements OnInit, OnDestroy {
    private readonly leadsService = inject(LeadsService);
    private readonly themeService = inject(ThemeService);
    private sub!: Subscription;

    topics: Topic[] = [];
    showAddForm = false;

    newTopic = {
        name: '',
        description: '',
        keywords: '',
        enabled: true,
    };

    ngOnInit() {
        this.themeService.setPersonality('control-center');
        this.sub = this.leadsService.getTopics().subscribe((topics) => {
            this.topics = topics;
        });
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }

    get activeCount(): number {
        return this.topics.filter((t) => t.enabled).length;
    }

    toggleTopic(topicId: string) {
        this.leadsService.toggleTopic(topicId);
    }

    addTopic() {
        if (!this.newTopic.name.trim()) return;
        const keywords = this.newTopic.keywords
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0);

        this.leadsService.addTopic({
            name: this.newTopic.name.trim(),
            description: this.newTopic.description.trim(),
            keywords,
            enabled: this.newTopic.enabled,
        });

        this.newTopic = { name: '', description: '', keywords: '', enabled: true };
        this.showAddForm = false;
    }

    cancelAdd() {
        this.newTopic = { name: '', description: '', keywords: '', enabled: true };
        this.showAddForm = false;
    }
}
