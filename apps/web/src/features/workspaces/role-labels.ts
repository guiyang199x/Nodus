import type { WorkspaceRole } from '@knowledge/domain';

/** The interface is Chinese; raw enum values never reach the screen. */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: '所有者',
  admin: '管理员',
  editor: '编辑者',
  viewer: '只读成员',
};
