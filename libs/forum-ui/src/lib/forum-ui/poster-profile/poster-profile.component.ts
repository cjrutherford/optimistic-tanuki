
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PosterDto, PosterStatsDto } from '../models';

@Component({
    selector: 'lib-forum-poster-profile',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './poster-profile.component.html',
    styleUrls: ['./poster-profile.component.scss'],
})
export class PosterProfileComponent {
    @Input() poster!: PosterDto;
    @Input() stats?: PosterStatsDto;

    getInitials(name: string): string {
        return name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }
}
