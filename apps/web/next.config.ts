import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

// The workspace keeps one .env.local at the monorepo root. Next only loads the
// app directory's own env files, so mirror the root file into process.env here
// without overriding anything the shell already set.
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = path.join(workspaceRoot, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator);
    if (process.env[key] === undefined) process.env[key] = trimmed.slice(separator + 1);
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Next 16 writes AGENTS.md and CLAUDE.md into apps/web on every dev run.
  // The repository keeps its agent instructions elsewhere, so opt out.
  agentRules: false,
  // APP_URL and supabase/config.toml both use 127.0.0.1, which Next 16 dev
  // otherwise treats as a foreign origin and refuses to serve dev resources
  // to, leaving the client unhydrated. Development only.
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@knowledge/domain', '@knowledge/ai', '@knowledge/observability'],
  // The proxy and the server runtimes do not inherit the process.env writes
  // above, so the values they need are declared here and inlined by Next.
  // Only non-secret configuration belongs in this block.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    APP_URL: process.env.APP_URL ?? '',
  },
};

export default nextConfig;
