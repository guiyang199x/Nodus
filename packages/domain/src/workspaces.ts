import { z } from 'zod';

import type { Database } from './database.types';

export const WorkspaceRoleSchema = z.enum(['owner', 'admin', 'editor', 'viewer']);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const WorkspaceKindSchema = z.enum(['personal', 'team']);
export type WorkspaceKind = z.infer<typeof WorkspaceKindSchema>;

export const CapabilitySchema = z.enum([
  'documents.read',
  'documents.upload',
  'documents.trash',
  'documents.delete',
  'jobs.reprocess',
  'knowledge.write',
  'comments.write',
  'qa.publish',
  'members.manage_basic',
  'members.manage_admin',
  'workspace.delete',
]);
export type Capability = z.infer<typeof CapabilitySchema>;
export const CAPABILITIES = CapabilitySchema.options;

const read: Capability[] = ['documents.read'];
const edit: Capability[] = [
  ...read,
  'documents.upload',
  'documents.trash',
  'knowledge.write',
  'comments.write',
  'qa.publish',
];

export const ROLE_CAPABILITIES: Readonly<Record<WorkspaceRole, readonly Capability[]>> = {
  viewer: read,
  editor: edit,
  admin: [...edit, 'documents.delete', 'jobs.reprocess', 'members.manage_basic'],
  owner: [...CAPABILITIES],
};

export function hasCapability(role: WorkspaceRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export const WorkspaceContextSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: WorkspaceRoleSchema,
  kind: WorkspaceKindSchema,
});
export type WorkspaceContext = z.infer<typeof WorkspaceContextSchema>;

export type ActionError = {
  code:
    | 'AUTH_REQUIRED'
    | 'FORBIDDEN'
    | 'INVALID_INPUT'
    | 'CONFLICT'
    | 'NOT_FOUND'
    | 'DEPENDENCY_FAILED';
  message: string;
};
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

/**
 * Compile-time guard that the contracts above stay identical to the database
 * enums they mirror. A silent divergence between the TypeScript union and the
 * Postgres enum would break authorization without failing a single test, so it
 * fails `pnpm typecheck` instead: on a mismatch the asserted type collapses to
 * `never` and `true` stops being assignable.
 *
 * Regenerate the database types with `pnpm db:types` after any migration that
 * touches `app_capability`, `workspace_role`, or `workspace_kind`.
 */
type ExactlyEqual<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : never
  : never;

export const CAPABILITY_MATCHES_DATABASE: ExactlyEqual<
  Capability,
  Database['public']['Enums']['app_capability']
> = true;

export const WORKSPACE_ROLE_MATCHES_DATABASE: ExactlyEqual<
  WorkspaceRole,
  Database['public']['Enums']['workspace_role']
> = true;

export const WORKSPACE_KIND_MATCHES_DATABASE: ExactlyEqual<
  WorkspaceKind,
  Database['public']['Enums']['workspace_kind']
> = true;
