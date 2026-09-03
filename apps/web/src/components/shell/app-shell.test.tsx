import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppShell } from './app-shell';

// The switcher reaches for the App Router and a server action, neither of
// which exists in jsdom. Both are seams, so both are stubbed here.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/workspaces/actions', () => ({
  setLastWorkspaceAction: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

const context = {
  workspaceId: '21000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000001',
  role: 'owner' as const,
  kind: 'team' as const,
};

describe('AppShell', () => {
  it('renders task navigation and an accessible mobile drawer control', () => {
    render(
      <AppShell
        context={context}
        workspaces={[{ id: context.workspaceId, name: 'Team One', kind: 'team', role: 'owner' }]}
      >
        <p>内容</p>
      </AppShell>
    );
    expect(screen.getByRole('button', { name: '打开侧栏' })).toBeVisible();
    expect(screen.getByRole('link', { name: '资料库' })).toHaveAttribute(
      'href',
      `/w/${context.workspaceId}/library`
    );
    expect(screen.getByRole('link', { name: '知识图谱' })).toBeVisible();
    expect(screen.getByRole('link', { name: '私密对话' })).toBeVisible();
    expect(screen.getByText('内容')).toBeVisible();
  });

  it('keeps every navigation target inside the current workspace', () => {
    render(
      <AppShell
        context={context}
        workspaces={[{ id: context.workspaceId, name: 'Team One', kind: 'team', role: 'owner' }]}
      >
        <p>内容</p>
      </AppShell>
    );
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(new RegExp(`^/w/${context.workspaceId}/`));
    }
  });
});
