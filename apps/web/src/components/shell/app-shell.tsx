'use client';

import {
  RiBook2Line,
  RiChat3Line,
  RiCloseLine,
  RiMenuLine,
  RiNodeTree,
  RiQuestionAnswerLine,
  RiTeamLine,
} from '@remixicon/react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import type { WorkspaceContext } from '@knowledge/domain';

import { AppIcon } from '@/components/ui/app-icon';
import type { WorkspaceSummary } from '@/features/workspaces/queries';

import { WorkspaceSwitcher } from './workspace-switcher';

export type AppShellProps = {
  context: WorkspaceContext;
  workspaces: WorkspaceSummary[];
  children: ReactNode;
};

export function AppShell({ context, workspaces, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const base = `/w/${context.workspaceId}`;
  const links = [
    ['资料库', `${base}/library`, RiBook2Line],
    ['知识图谱', `${base}/graph`, RiNodeTree],
    ['私密对话', `${base}/chat`, RiChat3Line],
    ['团队问答', `${base}/qa`, RiQuestionAnswerLine],
    ['成员与邀请', `${base}/settings/members`, RiTeamLine],
  ] as const;

  return (
    <div className="workspace-grid">
      <header className="mobile-bar">
        <button
          type="button"
          className="icon-button"
          aria-label="打开侧栏"
          aria-expanded={open}
          aria-controls="workspace-sidebar"
          title="打开侧栏"
          onClick={() => setOpen(true)}
        >
          <AppIcon icon={RiMenuLine} size="action" />
        </button>
      </header>

      <aside
        id="workspace-sidebar"
        className="workspace-sidebar"
        data-open={open}
        aria-label="工作区侧栏"
      >
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <WorkspaceSwitcher currentId={context.workspaceId} workspaces={workspaces} />
          </div>
          <button
            type="button"
            className="icon-button md:hidden"
            aria-label="关闭侧栏"
            title="关闭侧栏"
            onClick={() => setOpen(false)}
          >
            <AppIcon icon={RiCloseLine} />
          </button>
        </div>

        <Link
          href="/workspaces/new"
          onClick={() => setOpen(false)}
          className="mt-1 flex min-h-11 items-center rounded-[var(--radius-control)] px-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)]"
        >
          新建团队
        </Link>

        <nav aria-label="主导航" className="mt-3 space-y-0.5">
          {links.map(([label, href, icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm hover:bg-[var(--hover)]"
            >
              <AppIcon icon={icon} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="workspace-main">{children}</main>
    </div>
  );
}
