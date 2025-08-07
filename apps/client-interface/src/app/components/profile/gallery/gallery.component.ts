import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { CardComponent } from "@optimistic-tanuki/common-ui";

/**
 * Component for displaying a gallery item.
 */
@Component({
    standalone: true,
    imports: [CommonModule, MatCardModule, CardComponent],
    selector: 'app-gallery',
    templateUrl: './gallery.component.html',
    styleUrls: ['./gallery.component.scss']
})
export class GalleryComponent {
    /**
     * Input property for gallery item data.
     * @type {{coverPhoto: string, title: string}}
     */
    @Input() data: {coverPhoto: string, title: string} = {
        coverPhoto: 'https://placehold.it/300x300',
        title: 'Gallery'
    };
}