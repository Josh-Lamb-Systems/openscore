# OpenScore: agent guide

OpenScore is an open-source, self-hostable ScoreApp alternative: build scored quizzes ("scorecards"),
capture leads, show tier-based results pages, and push data out via webhooks.
**Product spec and every locked decision live in `docs/SPEC.md`. Read it before changing behaviour.**

## Stack

- React Router **v8** framework mode (SSR), React 19, TypeScript strict, Vite 8.
  The installed docs are the source of truth: `node_modules/react-router/docs/`. The agent skill is in `.agents/skills/react-router/`.
- Postgres 17 via Drizzle ORM (`drizzle-orm/node-postgres`), migrations in `drizzle/`.
- Better Auth (email/password + magic link), users table has a `role` of `admin | editor`.
- Tailwind CSS v4 (CSS-first tokens in `app/app.css`), Radix primitives via the `radix-ui` package, lucide-react icons.
- Zod v4 for all validation. Vitest for unit tests.

## Commands

```bash
docker compose up -d postgres   # dev database on 127.0.0.1:54329
npm run dev                     # app on http://localhost:5173
npm run dev:worker              # webhook delivery worker
npm run typecheck               # react-router typegen && tsc (must pass)
npm test                        # vitest (must pass)
npm run lint
npm run db:generate -- --name <change>   # after editing app/server/schema.server.ts
npm run db:migrate              # apply migrations
```

`.env` is loaded automatically by `app/server/env.server.ts` (copy `.env.example`).

## Layout

```
app/
  routes.ts                 # the full route map (manual config, no file-system routing)
  routes/auth/*             # login, setup (first admin), invite, reset-password, logout
  routes/app/layout.tsx     # signed-in shell: top bar; authMiddleware
  routes/app/global-layout.tsx        # sidebar for org-level pages
  routes/app/scorecard/layout.tsx     # per-scorecard sidebar + setup progress; useScorecard()
  routes/builder/*          # full-screen question/result builders (own authMiddleware)
  routes/public/*           # respondent-facing pages: /s/:slug, /embed/:slug, results, embed.js, /api/respond
  components/ui/*           # admin UI primitives (Button, Input, Field, Switch, Dialog, DropdownMenu, Tabs, misc)
  components/app/nav.tsx    # SidebarLayout, NavItem, PageContainer
  components/respondent/*   # themed respondent renderers (QuestionView, RespondentFrame, …), shared by builder canvas + public pages
  lib/                      # isomorphic, pure code (safe for client + server)
    scorecard/schema.ts     # Zod schema for the scorecard Definition + Answer types (single source of truth)
    scorecard/defaults.ts   # factories: createQuestion(type), createDefaultDefinition(name), newId()
    scorecard/validate.ts   # publish validation, answer validation, tier validation
    scorecard/setup.ts      # setup checklist steps
    scoring/score.ts        # scoring engine (pure, unit-tested)
    theme.ts                # brand tokens → --os-* CSS variables
  server/                   # server-only (*.server.ts never reach the client bundle)
    schema.server.ts        # Drizzle tables
    db.server.ts, env.server.ts, auth.server.ts, ids.server.ts, email.server.ts
    scorecards.server.ts    # scorecard CRUD, draft updates, publish/unpublish, theme resolution
    responses.server.ts     # response helpers (definitionForResponse, resultUrl)
    webhooks.server.ts      # payloads, signing, enqueue (emitLeadCaptured / emitResponseCompleted), delivery
worker/index.ts             # webhook delivery loop
scripts/                    # migrate.ts, seed.ts
```

## Conventions

- **Data flow:** route `loader`/`action` + `<Form>`/`useFetcher`. Never `useEffect`-fetch route data.
  Use typed `Route.*` from `./+types/<file>`. Multi-action routes post an `intent` field.
- **Auth:** routes under `routes/app/layout.tsx` and `routes/builder/layout.tsx` are protected by `authMiddleware`.
  Get the user with `context.get(userContext)!`. Admin-only actions call `requireAdmin(user)`.
  Standalone routes (preview, CSV) call `await requireUser(request)` themselves.
- **Server-only code** goes in `app/server/*.server.ts`. Do not import `*.server` modules from components.
- **Definitions:** never mutate the live version. Editors write the draft via
  `updateDraft(id, { <only the keys you own> })`. The questions builder owns `questions` and `categories`,
  the results builder owns `resultPage`, the tiers page owns `tiers`, the lead form page owns `leadForm`,
  and general settings own `startScreen`. Theme lives on the scorecard row (`brandKitId`, `themeOverrides`) and is not versioned.
- **Scoring** only through `app/lib/scoring/score.ts`. Add tests for any change there.
- **Respondent UI** uses the `--os-*` CSS variables (wrap in `RespondentFrame`). Admin UI uses Tailwind tokens
  (`brand-*` teal, `ink`). Never use ScoreApp's name, logo or blue in the UI.
- **Rich text** (result copy, info screens) is stored as HTML and must be sanitised server-side on save
  (`sanitize-html`) before it is rendered with `dangerouslySetInnerHTML`.
- **Webhooks** must never break the respondent flow: the `emit*` helpers swallow errors.
- **IDs:** table primary keys use `createId("<prefix>")` (server); definition entities use `newId("<prefix>")` (lib).
- Keep components small and colocated. Match the existing style: 2-space indent, double quotes, explicit types at module boundaries.
- Before finishing: `npm run typecheck && npm test` must pass.
