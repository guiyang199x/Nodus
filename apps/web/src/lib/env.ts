import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});
const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  INVITATION_EMAIL_FROM: z.string().min(3),
});

export function getPublicEnv() {
  return publicSchema.parse(process.env);
}
export function getServerEnv() {
  return serverSchema.parse(process.env);
}
