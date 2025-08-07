import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { TileComponent } from "@optimistic-tanuki/common-ui";



@Component({
    standalone: true,
    selector: 'app-friends',
    templateUrl: './friends.component.html',
    styleUrls: ['./friends.component.scss'],
    imports: [CommonModule, MatCardModule, MatListModule, MatIconModule, TileComponent],
})
/**
 * Component for displaying a friend's information.
 */
export class FriendsComponent {
    /**
     * Input property for friend data.
     * @type {{photo: string, name: string}}
     */
    @Input() friend: {photo: string, name: string} = {
        photo: 'https://placehold.it/300x300',
        name: 'Friend',
    }
}