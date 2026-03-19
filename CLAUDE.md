# Clubhouse Lines — Claude Guidelines

## Project
Private sports picks club. Next.js 16, React 19, TypeScript, Drizzle ORM, Neon (PostgreSQL), Clerk Auth v7, Resend email, Vercel. Two modes: Demo (in-memory) and Live (DB-backed), toggled by `DATABASE_URL`.

## Git Workflow
- **Always `git fetch && git status` before implementing.** The remote is active — check for divergence before touching any files.
- Push to `main` directly (no PR required unless user requests one).
- Do not commit until the user explicitly asks, or tests pass and user approves.

## Stack Notes
- CSP is set dynamically per-request in `src/proxy.ts` (nonce-based). Do not add static `Content-Security-Policy` headers to `next.config.ts`.
- Rate-limit categories must be shared between server actions (`src/app/actions.ts`) and API routes (`src/app/api/admin/*/route.ts`) — identical category strings.
- `getMemberSnapshot()` returns the full viewer context; prefer it over individual queries when building new pages.

## Design System
- Dark-only. `--accent: #CC2936`, `--background: #07121b`, `--panel`, `--muted-foreground: #9db1bf`.
- Cards: `rounded-[28px]`. Buttons: `rounded-full`. Inner elements: `rounded-2xl` or `rounded-3xl`.
- Fonts: Space Grotesk (display) + IBM Plex Mono (mono).
- Keyframes: `fade-in`, `shimmer`, `border-glow` (defined in `globals.css`).

## Testing
- Run `npm test` (vitest) after any logic changes. All 17 tests must pass.
- Run `npx tsc --noEmit` before committing.

## User Preferences
- Full permissions granted — no approval needed before pushing code.
- Do not ask for approval before committing/pushing when tests pass.
- Keep responses concise. No trailing summaries of what was just done.
