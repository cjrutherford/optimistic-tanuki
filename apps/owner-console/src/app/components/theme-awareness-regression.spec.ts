import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function sourceFile(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), 'utf8');
}

describe('owner console theme awareness regression', () => {
  it('keeps the main logged-in surfaces driven by theme tokens instead of hard-coded palette values', () => {
    const surfaces = [
      {
        name: 'OperatorOverviewComponent',
        styles: sourceFile('./operator-overview.component.ts'),
      },
      {
        name: 'OperatorQueuePanelComponent',
        styles: sourceFile('./operator-queue-panel.component.ts'),
      },
      {
        name: 'OperationsWorkspaceComponent',
        styles: sourceFile('./operations-workspace.component.ts'),
      },
      {
        name: 'ContactLeadsManagementComponent',
        styles: sourceFile('./contact-leads-management.component.ts'),
      },
      {
        name: 'PermissionsInspectorComponent',
        styles: sourceFile('./permissions-inspector.component.ts'),
      },
      {
        name: 'LoginComponent',
        styles: sourceFile('./login.component.ts'),
      },
      {
        name: 'PublicControlCenterComponent',
        styles: sourceFile('./public-control-center.component.ts'),
      },
      {
        name: 'ForumGovernanceComponent',
        styles: sourceFile('./forum-governance.component.ts'),
      },
      {
        name: 'AppConfigListComponent',
        styles: sourceFile(
          './app-config-designer/app-config-list.component.ts'
        ),
      },
      {
        name: 'PermissionsManagementComponent',
        styles: sourceFile('./permissions-management.component.ts'),
      },
      {
        name: 'AppScopesManagementComponent',
        styles: sourceFile('./app-scopes-management.component.ts'),
      },
      {
        name: 'CommunityManagementComponent',
        styles: sourceFile('./community-management.component.ts'),
      },
      {
        name: 'CommunityEditorComponent',
        styles: sourceFile('./community-editor.component.ts'),
      },
      {
        name: 'RolesManagementComponent',
        styles: sourceFile('./roles-management.component.ts'),
      },
      {
        name: 'CityManagementComponent',
        styles: sourceFile('./city-management.component.ts'),
      },
      {
        name: 'CityEditorComponent',
        styles: sourceFile('./city-editor.component.ts'),
      },
      {
        name: 'AdminControlCenterComponent',
        styles: sourceFile('./admin-control-center.component.ts'),
      },
      {
        name: 'UsersManagementComponent',
        styles: sourceFile('./users-management.component.ts'),
      },
      {
        name: 'AgUsersTableComponent',
        styles: sourceFile('./ag-users-table.component.ts'),
      },
      {
        name: 'AgRolesTableComponent',
        styles: sourceFile('./ag-roles-table.component.ts'),
      },
      {
        name: 'AgPermissionsTableComponent',
        styles: sourceFile('./ag-permissions-table.component.ts'),
      },
      {
        name: 'AgAppScopesTableComponent',
        styles: sourceFile('./ag-app-scopes-table.component.ts'),
      },
      {
        name: 'RegistryManagementComponent',
        styles: sourceFile('./registry-management.component.ts'),
      },
      {
        name: 'SocialGovernanceComponent',
        styles: sourceFile('./social-governance.component.ts'),
      },
      {
        name: 'AppointmentManagementComponent',
        styles: sourceFile('./appointment-management.component.scss'),
      },
      {
        name: 'AvailabilityManagementComponent',
        styles: sourceFile('./availability-management.component.scss'),
      },
      {
        name: 'ProductManagementComponent',
        styles: sourceFile('./product-management.component.scss'),
      },
      {
        name: 'ResourceManagementComponent',
        styles: sourceFile('./resource-management.component.scss'),
      },
      {
        name: 'OrderManagementComponent',
        styles: sourceFile('./order-management.component.scss'),
      },
      {
        name: 'StoreOverviewComponent',
        styles: sourceFile('./store-overview.component.scss'),
      },
      {
        name: 'SectionSelectorComponent',
        styles: sourceFile(
          './app-config-designer/section-editors/section-selector.component.ts'
        ),
      },
      {
        name: 'SectionEditorComponent',
        styles: sourceFile(
          './app-config-designer/section-editors/section-editor.component.scss'
        ),
      },
      {
        name: 'WorkspaceLandingComponent',
        styles: sourceFile('./workspace-landing.component.ts'),
      },
      {
        name: 'CommunityMembersComponent',
        styles: sourceFile('./community-members.component.ts'),
      },
      {
        name: 'AppConfigDesignerComponentStyles',
        styles: sourceFile(
          './app-config-designer/app-config-designer.component.scss'
        ),
      },
      {
        name: 'BusinessSiteCatalogManagementComponent',
        styles: sourceFile('./business-site-catalog-management.component.ts'),
      },
    ];

    for (const surface of surfaces) {
      expect(surface.styles).toContain('var(--surface');
      expect(surface.styles).toContain('var(--foreground');
      expect(surface.styles).not.toContain('background: white');
      expect(surface.styles).not.toContain('color: white');
      expect(surface.styles).not.toContain('#007bff');
      expect(surface.styles).not.toContain('#0f766e');
      expect(surface.styles).not.toContain('#8d4b00');
      expect(surface.styles).not.toContain('#f8f9fa');
    }
  });
});
