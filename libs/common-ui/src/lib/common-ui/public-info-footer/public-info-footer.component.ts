import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'otui-public-info-footer',
  imports: [],
  templateUrl: './public-info-footer.component.html',
  styleUrl: './public-info-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicInfoFooterComponent {
  @Input() productName = '';
  @Input() tagline = '';
}
