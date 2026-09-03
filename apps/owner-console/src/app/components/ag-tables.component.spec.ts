import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';
import { ColDef } from 'ag-grid-community';

import { AgAppScopesTableComponent } from './ag-app-scopes-table.component';
import { AgPermissionsTableComponent } from './ag-permissions-table.component';
import { AgRolesTableComponent } from './ag-roles-table.component';
import { AgUsersTableComponent } from './ag-users-table.component';

type AnyTable = {
  columnDefs: ColDef[];
  gridData: () => unknown[];
  ngOnInit: () => void;
  ngOnChanges: (changes: Record<string, unknown>) => void;
};

const columnFor = (component: AnyTable, headerName: string): ColDef =>
  component.columnDefs.find((c) => c.headerName === headerName) as ColDef;

const renderActions = (component: AnyTable, data: unknown): HTMLElement =>
  (columnFor(component, 'Actions').cellRenderer as (p: unknown) => HTMLElement)(
    { data }
  );

async function mount<T>(
  type: Type<T>
): Promise<{ fixture: ComponentFixture<T>; component: T }> {
  await TestBed.configureTestingModule({ imports: [type] }).compileComponents();
  const fixture = TestBed.createComponent(type);
  return { fixture, component: fixture.componentInstance };
}

describe('ag grid governance tables', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('AgAppScopesTableComponent', () => {
    const scopes = [
      { id: 'scope-1', name: 'global', description: 'Global', active: true },
      { id: 'scope-2', name: 'store', description: 'Store', active: false },
    ];

    it('mirrors the scope input into the grid on init and on change', async () => {
      const { component } = await mount(AgAppScopesTableComponent);

      component.appScopes = scopes as never;
      component.ngOnInit();
      expect(component.gridData()).toEqual(scopes);

      component.appScopes = [scopes[0]] as never;
      component.ngOnChanges({ appScopes: {} as never });
      expect(component.gridData()).toHaveLength(1);
    });

    it('tolerates a null scope input', async () => {
      const { component } = await mount(AgAppScopesTableComponent);

      component.appScopes = null as never;
      component.ngOnInit();

      expect(component.gridData()).toEqual([]);
    });

    it('ignores unrelated input changes', async () => {
      const { component } = await mount(AgAppScopesTableComponent);

      component.appScopes = scopes as never;
      component.ngOnInit();
      component.appScopes = [] as never;
      component.ngOnChanges({ loading: {} as never });

      expect(component.gridData()).toHaveLength(2);
    });

    it('renders an active/inactive status badge', async () => {
      const { component } = await mount(AgAppScopesTableComponent);
      const render = columnFor(component as never, 'Status').cellRenderer as (
        p: unknown
      ) => HTMLElement;

      expect(render({ value: true }).textContent).toBe('Active');
      expect(render({ value: false }).textContent).toBe('Inactive');
    });

    it('reports the permission count per scope, defaulting to zero', async () => {
      const { component } = await mount(AgAppScopesTableComponent);
      component.permissionCounts = new Map([['scope-1', 3]]);
      const get = columnFor(component as never, 'Permissions').valueGetter as (
        p: unknown
      ) => string;

      expect(get({ data: { id: 'scope-1' } })).toBe('3 permission(s)');
      expect(get({ data: { id: 'scope-2' } })).toBe('0 permission(s)');
    });

    it('emits edit and delete from the row action buttons', async () => {
      const { component } = await mount(AgAppScopesTableComponent);
      const edited = jest.fn();
      const deleted = jest.fn();
      component.edit.subscribe(edited);
      component.delete.subscribe(deleted);

      const buttons = Array.from(
        renderActions(component as never, scopes[0]).querySelectorAll('button')
      );
      buttons[0].click();
      buttons[1].click();

      expect(edited).toHaveBeenCalledWith(scopes[0]);
      expect(deleted).toHaveBeenCalledWith(scopes[0]);
    });

    it('emits create from the toolbar button', async () => {
      const { fixture, component } = await mount(AgAppScopesTableComponent);
      const created = jest.fn();
      component.create.subscribe(created);
      fixture.detectChanges();

      (
        fixture.nativeElement.querySelector('.create-button') as HTMLElement
      ).click();

      expect(created).toHaveBeenCalled();
    });
  });

  describe('AgPermissionsTableComponent', () => {
    const permissions = [
      {
        id: 'perm-1',
        name: 'users.read',
        description: 'Read users',
        resource: 'users',
        action: 'read',
      },
    ];

    it('mirrors the permission input into the grid', async () => {
      const { component } = await mount(AgPermissionsTableComponent);

      component.permissions = permissions as never;
      component.ngOnInit();
      expect(component.gridData()).toEqual(permissions);

      component.permissions = null as never;
      component.ngOnChanges({ permissions: {} as never });
      expect(component.gridData()).toEqual([]);
    });

    it('ignores unrelated input changes', async () => {
      const { component } = await mount(AgPermissionsTableComponent);

      component.permissions = permissions as never;
      component.ngOnInit();
      component.permissions = [] as never;
      component.ngOnChanges({ height: {} as never });

      expect(component.gridData()).toHaveLength(1);
    });

    it('labels a missing app scope and target id', async () => {
      const { component } = await mount(AgPermissionsTableComponent);
      const format = (header: string, value: unknown) =>
        (
          columnFor(component as never, header).valueFormatter as (
            p: unknown
          ) => string
        )({ value });

      expect(format('App Scope', 'global')).toBe('global');
      expect(format('App Scope', undefined)).toBe('None');
      expect(format('Target ID', 'target-1')).toBe('target-1');
      expect(format('Target ID', undefined)).toBe('Global');
    });

    it('emits edit and delete from the row action buttons', async () => {
      const { component } = await mount(AgPermissionsTableComponent);
      const edited = jest.fn();
      const deleted = jest.fn();
      component.edit.subscribe(edited);
      component.delete.subscribe(deleted);

      const buttons = Array.from(
        renderActions(component as never, permissions[0]).querySelectorAll(
          'button'
        )
      );
      buttons[0].click();
      buttons[1].click();

      expect(edited).toHaveBeenCalledWith(permissions[0]);
      expect(deleted).toHaveBeenCalledWith(permissions[0]);
    });
  });

  describe('AgRolesTableComponent', () => {
    const roles = [{ id: 'role-1', name: 'owner', description: 'Owner role' }];

    it('mirrors the role input into the grid', async () => {
      const { component } = await mount(AgRolesTableComponent);

      component.roles = roles as never;
      component.ngOnInit();
      expect(component.gridData()).toEqual(roles);

      component.roles = null as never;
      component.ngOnChanges({ roles: {} as never });
      expect(component.gridData()).toEqual([]);
    });

    it('labels a missing app scope', async () => {
      const { component } = await mount(AgRolesTableComponent);
      const format = columnFor(component as never, 'App Scope')
        .valueFormatter as (p: unknown) => string;

      expect(format({ value: 'global' })).toBe('global');
      expect(format({ value: null })).toBe('N/A');
    });

    it('emits edit and delete from the row action buttons', async () => {
      const { component } = await mount(AgRolesTableComponent);
      const edited = jest.fn();
      const deleted = jest.fn();
      component.edit.subscribe(edited);
      component.delete.subscribe(deleted);

      const buttons = Array.from(
        renderActions(component as never, roles[0]).querySelectorAll('button')
      );
      buttons[0].click();
      buttons[1].click();

      expect(edited).toHaveBeenCalledWith(roles[0]);
      expect(deleted).toHaveBeenCalledWith(roles[0]);
    });
  });

  describe('AgUsersTableComponent', () => {
    const users = [
      { id: 'profile-1', profileName: 'Operator', userId: 'user-1' },
    ];

    it('mirrors the user input into the grid', async () => {
      const { component } = await mount(AgUsersTableComponent);

      component.users = users as never;
      component.ngOnInit();
      expect(component.gridData()).toEqual(users);

      component.users = null as never;
      component.ngOnChanges({ users: {} as never });
      expect(component.gridData()).toEqual([]);
    });

    it('labels an empty bio', async () => {
      const { component } = await mount(AgUsersTableComponent);
      const format = columnFor(component as never, 'Bio').valueFormatter as (
        p: unknown
      ) => string;

      expect(format({ value: 'Hello' })).toBe('Hello');
      expect(format({ value: '' })).toBe('N/A');
    });

    it('emits the profile behind the manage-roles button', async () => {
      const { component } = await mount(AgUsersTableComponent);
      const managed = jest.fn();
      component.manageRoles.subscribe(managed);

      const button = renderActions(component as never, users[0]).querySelector(
        'button'
      ) as HTMLButtonElement;
      button.click();

      expect(managed).toHaveBeenCalledWith(users[0]);
    });

    it('clears the grid selection when the reset key changes', async () => {
      const { fixture, component } = await mount(AgUsersTableComponent);
      component.users = users as never;
      fixture.detectChanges();

      const deselectAll = jest.fn();
      const grid = (component as unknown as { grid?: { gridApi?: unknown } })
        .grid;
      if (grid) {
        (grid as { gridApi?: unknown }).gridApi = { deselectAll };
      }
      const cleared = jest.fn();
      component.selectionChange.subscribe(cleared);

      component.ngOnChanges({
        selectionResetKey: { firstChange: false } as never,
      });

      expect(cleared).toHaveBeenCalledWith([]);
      if (grid) {
        expect(deselectAll).toHaveBeenCalled();
      }
    });

    it('leaves the selection alone on the first reset-key binding', async () => {
      const { component } = await mount(AgUsersTableComponent);
      const cleared = jest.fn();
      component.selectionChange.subscribe(cleared);

      component.ngOnChanges({
        selectionResetKey: { firstChange: true } as never,
      });

      expect(cleared).not.toHaveBeenCalled();
    });
  });
});
