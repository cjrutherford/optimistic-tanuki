import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import {
  SocialComponentDto,
  CreateSocialComponentDto,
  UpdateSocialComponentDto
} from '@optimistic-tanuki/ui-models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

export interface ComponentExtractionResult {
  instanceId: string;
  componentType: string;
  componentData: Record<string, any>;
  position: number;
  domNode: HTMLElement;
}

@Injectable({
  providedIn: 'root'
})
export class SocialComponentPersistenceService {
  private readonly baseApiUrl = inject(API_BASE_URL);
  private readonly gatewayUrl = `${this.baseApiUrl}/social-components`;

  constructor(private http: HttpClient) { }

  /**
   * Extracts component data from HTML content for database persistence
   */
  extractComponentsFromContent(content: string): ComponentExtractionResult[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const componentNodes = doc.querySelectorAll('[data-angular-component]');

    const components: ComponentExtractionResult[] = [];

    componentNodes.forEach((node, index) => {
      const componentId = node.getAttribute('data-component-id');
      const instanceId = node.getAttribute('data-instance-id');
      const dataStr = node.getAttribute('data-component-data');

      if (componentId && instanceId && dataStr) {
        try {
          components.push({
            instanceId,
            componentType: componentId,
            componentData: JSON.parse(dataStr),
            position: index,
            domNode: node as HTMLElement
          });
        } catch (error) {
          console.warn('[SocialComponentPersistence] Failed to parse component data:', instanceId, error);
        }
      } else {
        console.warn('[SocialComponentPersistence] Component missing required attributes:', {
          componentId,
          instanceId,
          hasData: !!dataStr
        });
      }
    });

    return components;
  }

  /**
   * Saves components to the database using RPC
   */
  saveComponents(postId: string, components: ComponentExtractionResult[]): Observable<SocialComponentDto[]> {
    if (components.length === 0) {
      return new Observable(observer => {
        observer.next([]);
        observer.complete();
      });
    }

    const saveRequests = components.map(comp => {
      const createDto: CreateSocialComponentDto = {
        postId,
        instanceId: comp.instanceId,
        componentType: comp.componentType,
        componentData: comp.componentData,
        position: comp.position
      };

      return this.http.post<SocialComponentDto>(`${this.gatewayUrl}`, createDto);
    });

    return forkJoin(saveRequests);
  }

  /**
   * Gets stored components for a social post using RPC
   */
  getComponentsForPost(postId: string): Observable<SocialComponentDto[]> {
    return this.http.get<SocialComponentDto[]>(`${this.gatewayUrl}/post/${postId}`);
  }

  /**
   * Updates a component in the database using RPC
   */
  updateComponent(componentId: string, componentData: Record<string, any>, position?: number): Observable<SocialComponentDto> {
    const updateDto: UpdateSocialComponentDto = {
      componentData,
      ...(position !== undefined && { position })
    };

    return this.http.put<SocialComponentDto>(`${this.gatewayUrl}/${componentId}`, updateDto);
  }

  /**
   * Deletes a component from the database using RPC
   */
  deleteComponent(componentId: string): Observable<void> {
    return this.http.delete<void>(`${this.gatewayUrl}/${componentId}`);
  }

  /**
   * Deletes all components for a post using RPC
   */
  deleteComponentsByPost(postId: string): Observable<void> {
    return this.http.delete<void>(`${this.gatewayUrl}/post/${postId}`);
  }

  /**
   * Cleans content for storage by removing component data attributes
   * but keeping placeholders for reconstruction
   */
  cleanContentForStorage(content: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const componentNodes = doc.querySelectorAll('[data-angular-component]');

    componentNodes.forEach(node => {
      // Remove data attributes but keep structure for reconstruction
      node.removeAttribute('data-component-data');
      // Keep data-component-id and data-instance-id for reconstruction
    });

    return doc.documentElement.innerHTML;
  }
}
