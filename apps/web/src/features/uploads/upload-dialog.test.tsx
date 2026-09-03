import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UploadDialog } from './upload-dialog';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const teamEditor = {
  workspaceId: '41000000-0000-4000-8000-000000000001',
  userId: '40000000-0000-4000-8000-000000000002',
  role: 'editor' as const,
  kind: 'team' as const,
};

describe('UploadDialog', () => {
  it('names the target workspace and warns before a team upload', () => {
    render(<UploadDialog context={teamEditor} workspaceName="Upload Team" onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '上传资料' }));
    expect(screen.getByText('上传到 Upload Team')).toBeVisible();
    expect(screen.getByText('Upload Team 的所有成员都能看到这些资料。')).toBeVisible();
    expect(screen.getByLabelText('选择资料')).toHaveAttribute('multiple');
  });

  it('renders no upload control for a viewer', () => {
    render(
      <UploadDialog
        context={{ ...teamEditor, role: 'viewer' }}
        workspaceName="Upload Team"
        onCompleted={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: '上传资料' })).not.toBeInTheDocument();
    expect(screen.getByText('你在此工作区拥有只读权限。')).toBeVisible();
  });

  it('does not warn about teammates in a personal workspace', () => {
    render(
      <UploadDialog
        context={{ ...teamEditor, kind: 'personal', role: 'owner' }}
        workspaceName="我的空间"
        onCompleted={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '上传资料' }));
    expect(screen.getByText('上传到 我的空间')).toBeVisible();
    expect(screen.queryByText(/都能看到这些资料/)).not.toBeInTheDocument();
  });
});
