import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { Capability, PrivateCloudPath } from '../../content/site-content';

@Component({
  selector: 'hai-private-cloud-section',
  standalone: true,
  imports: [RouterLink, CardComponent],
  templateUrl: './private-cloud-section.component.html',
  styleUrl: './private-cloud-section.component.scss',
})
export class PrivateCloudSectionComponent {
  @Input({ required: true }) intro!: { headline: string; summary: string };
  @Input({ required: true }) capabilities: Capability[] = [];
  @Input({ required: true }) paths: PrivateCloudPath[] = [];
}
