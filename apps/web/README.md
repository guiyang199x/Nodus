# @knowledge/web

Next.js 16 web application for the AI Knowledge Base project.

## Getting Started

### Development

From the workspace root:

```bash
# Install dependencies (if not already done)
pnpm install

# Start Supabase (if not already running)
pnpm db:start

# Start the development server
pnpm dev:web
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Project Structure

```
apps/web/
├── app/              # Next.js App Router pages
│   ├── layout.tsx    # Root layout
│   ├── page.tsx      # Home page
│   └── globals.css   # Global styles
├── components/       # Shared React components
├── lib/              # Utility functions and clients
│   └── supabase/     # Supabase client utilities
├── public/           # Static assets
├── styles/           # Additional styles
└── next.config.js    # Next.js configuration
```

## Features

- **Next.js 16** - React framework with App Router
- **React 19** - Latest React with Server Components
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first CSS framework
- **Supabase** - Authentication, database, and storage

## Environment Variables

This app uses environment variables from the workspace root (`.env.local`).

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

See `../../.env.README.md` for configuration details.

## Building for Production

```bash
pnpm --filter @knowledge/web build
pnpm --filter @knowledge/web start
```

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase (via @supabase/ssr)
- PostCSS + Autoprefixer
