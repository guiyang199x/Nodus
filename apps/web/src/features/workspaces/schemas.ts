import { z } from 'zod';

export const CreateTeamSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{2,62}$/),
});

export const InviteMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  // Owner is absent on purpose: ownership moves only through transfer.
  role: z.enum(['admin', 'editor', 'viewer']),
});
