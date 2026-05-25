import {
  AfterViewInit,
  Component,
  ComponentRef,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  Type,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import DOMPurify from 'dompurify';
import {
  CalloutBoxComponent,
  CodeSnippetComponent,
  ImageGalleryComponent,
} from '@optimistic-tanuki/compose-lib';
import { LandingSectionRichContent } from '@optimistic-tanuki/business-data-access';

const COMPONENT_MAP: Record<string, Type<unknown>> = {
  'callout-box': CalloutBoxComponent,
  'code-snippet': CodeSnippetComponent,
  'image-gallery': ImageGalleryComponent,
};

@Component({
  selector: 'business-rich-content-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #contentRoot class="rich-content-renderer"></div>
    <ng-container #componentHost></ng-container>
  `,
})
export class BusinessRichContentRendererComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() content: LandingSectionRichContent | null = null;

  @ViewChild('contentRoot', { static: true })
  private readonly contentRoot?: ElementRef<HTMLElement>;

  @ViewChild('componentHost', { read: ViewContainerRef, static: true })
  private readonly componentHost?: ViewContainerRef;

  private readonly componentRefs: ComponentRef<unknown>[] = [];
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderContent();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }

    this.renderContent();
  }

  ngOnDestroy(): void {
    this.destroyComponentRefs();
  }

  private renderContent(): void {
    if (!this.contentRoot) {
      return;
    }

    this.destroyComponentRefs();

    const html = this.content?.content?.trim() ?? '';
    this.contentRoot.nativeElement.innerHTML = html
      ? DOMPurify.sanitize(html)
      : '';

    if (!this.content?.injectedComponents?.length) {
      return;
    }

    const nodes = this.contentRoot.nativeElement.querySelectorAll(
      '[data-angular-component][data-instance-id]'
    );

    nodes.forEach((node) => {
      const instanceId = node.getAttribute('data-instance-id');
      if (!instanceId) {
        return;
      }

      const componentData = this.content?.injectedComponents?.find(
        (
          component: NonNullable<
            LandingSectionRichContent['injectedComponents']
          >[number]
        ) => component.instanceId === instanceId
      );
      if (!componentData) {
        return;
      }

      const componentType = componentData.componentType;
      const componentClass = COMPONENT_MAP[componentType];
      if (!componentClass || !this.componentHost) {
        return;
      }

      const componentRef = this.componentHost.createComponent(componentClass);
      const instance = componentRef.instance as Record<string, unknown>;
      Object.entries(componentData.componentData ?? {}).forEach(
        ([key, value]) => {
          if (key in instance) {
            instance[key] = value;
          }
        }
      );
      componentRef.changeDetectorRef.detectChanges();
      this.componentRefs.push(componentRef);

      const host = node as HTMLElement;
      host.innerHTML = '';
      host.appendChild(componentRef.location.nativeElement);
    });
  }

  private destroyComponentRefs(): void {
    this.componentRefs.splice(0).forEach((ref) => ref.destroy());
    this.componentHost?.clear();
  }
}
