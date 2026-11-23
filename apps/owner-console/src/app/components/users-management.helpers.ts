import type { ColDef } from '@optimistic-tanuki/ag-grid-ui';
import type {
  BulkRoleMutationPermissionChangeDto,
  BulkRoleMutationResultDto,
  ProfileDto,
} from '@optimistic-tanuki/ui-models';

export function buildUsersColumns(
  onManageRoles: (user: ProfileDto) => void
): ColDef[] {
  return [
    {
      headerName: '',
      width: 64,
      pinned: 'left',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      sortable: false,
      filter: false,
      resizable: false,
    },
    { field: 'profileName', headerName: 'Name', flex: 2 },
    { field: 'userId', headerName: 'User ID', flex: 2 },
    {
      field: 'bio',
      headerName: 'Bio',
      flex: 3,
      valueFormatter: (params) => params.value || 'N/A',
    },
    {
      headerName: 'Roles',
      width: 160,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data: ProfileDto }) => {
        const button = document.createElement('button');
        button.textContent = 'Manage roles';
        button.className = 'ag-grid-action-button';
        button.addEventListener('click', () => onManageRoles(params.data));
        return button;
      },
    },
  ];
}

export function describePermissionStatus(
  status: BulkRoleMutationPermissionChangeDto['status']
): string {
  switch (status) {
    case 'added':
      return 'Will grant new access';
    case 'removed':
      return 'Will remove access';
    case 'retained':
      return 'Access remains through another role';
    case 'already-present':
      return 'Profile already had this access';
    default:
      return status;
  }
}

export function buildAuditSummary(result: BulkRoleMutationResultDto): string {
  return `${result.roleName} ${
    result.operation === 'assign' ? 'assignment' : 'removal'
  } completed for ${result.completedCount} of ${
    result.totalSelected
  } selected profiles in scope ${result.appScopeId}${
    result.targetId ? ` targeting ${result.targetId}` : ''
  }.`;
}
