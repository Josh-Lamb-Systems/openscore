# OpenScore

**Open-source, self-hostable scorecards and quizzes that qualify your leads.**

Build a scored quiz, share it or embed it on your site, capture leads, and give every respondent a
personalised results page based on their score. Then push everything to your own tools with signed webhooks.
OpenScore is an open-source alternative to tools like ScoreApp.

- **Question builder:** 11 question types (yes/no/maybe, buttons, radio, checkboxes, image buttons,
  sliding/linear/divided scales, numeric, open text, info screens), drag-and-drop ordering, undo/redo,
  and a live preview.
- **Scoring:** per-answer points, categories, score tiers, and per-category breakdowns.
- **Results pages:** tier-specific copy, category insights, and a call to action.
- **Lead capture:** configurable fields before or after the questions, with explicit or implied consent.
- **Draft and publish:** responses are pinned to the version they answered, and draft-mode test data is kept separate.
- **Brand kits:** logo, colours, fonts and button style, overridable per scorecard.
- **Share and embed:** hosted URL, auto-resizing iframe embed (`embed.js`).
- **Webhooks:** `lead.captured` and `response.completed`, HMAC-signed, with automatic retries.
- **Team:** invite teammates as admins or editors. Sign in with a password or a magic link.

## Self-hosting

Requirements: Docker with Compose v2.

```bash
git clone https://github.com/Josh-Lamb-Systems/openscore.git && cd openscore
cp .env.example .env
# edit .env: set APP_URL to your public URL, AUTH_SECRET (openssl rand -base64 32), SMTP_* for emails
docker compose --profile app up -d --build
```

Open `APP_URL` and create the first admin account on the setup page. Put a TLS-terminating reverse proxy
(Caddy, Traefik, nginx) in front of port 3000 for production.

| Service    | Purpose                                                    |
| ---------- | ---------------------------------------------------------- |
| `postgres` | Database (named volume `postgres-data`)                    |
| `web`      | The app on port 3000; applies database migrations on start |
| `worker`   | Delivers webhooks with retries                             |

Without `SMTP_HOST`, invite, magic-link and password-reset emails are printed to the `web` logs.

### Webhooks

Each delivery is a `POST` with a JSON body and these headers:

- `OpenScore-Event`: `lead.captured`, `response.completed` or `ping`
- `OpenScore-Delivery`: a unique delivery id (use it for idempotency)
- `OpenScore-Signature`: `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`

Failed deliveries are retried after 1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours.
Test responses (taken in draft preview) are delivered too, with `"isTest": true`.

## Development

Requirements: Node 24 (see `mise.toml`) and Docker.

```bash
npm install
cp .env.example .env            # then set AUTH_SECRET
docker compose up -d postgres   # Postgres on 127.0.0.1:54329
npm run db:migrate
npm run dev                     # http://localhost:5173
npm run dev:worker              # optional: webhook worker
npm run db:seed                 # optional: example scorecard (after creating your admin)
```

| Command                                                       | What it does                       |
| ------------------------------------------------------------- | ---------------------------------- |
| `npm run typecheck`                                           | Route typegen + TypeScript         |
| `npm test`                                                    | Unit tests (Vitest)                |
| `npm run lint`                                                | ESLint                             |
| `npm run db:generate -- --name <x>`                           | New migration from schema changes  |
| `scripts/shot.sh <path> <file.png>`                           | Screenshot a page (Playwright in Docker) for visual QA |

Architecture, conventions and the product spec: [`CLAUDE.md`](CLAUDE.md) and [`docs/SPEC.md`](docs/SPEC.md).

## License

Apache-2.0
