# OpenScore — v1 Product Spec

OpenScore is an open-source, self-hostable alternative to [ScoreApp](https://www.scoreapp.com/):
build a scored quiz ("scorecard"), share it, capture leads, show each respondent a personalised
results page, and push the data to other systems via webhooks.

Status: **decisions locked for v1** (2026-10-28).

---

## 1. Decisions

| Area | Decision |
|---|---|
| Deployment | Self-host first. `docker compose up` = app + worker + Postgres. No billing, plan limits, or upgrade banners. |
| Contributors | Mostly AI agents + maintainer → favour mainstream, strongly typed, well-documented tools. |
| Architecture | Single TypeScript full-stack app (web server + background worker from the same codebase). |
| Framework | React Router v7 (framework mode): SSR for public pages, SPA-style builder. |
| Database | Postgres only. JSONB for scorecard definitions. The `webhook_deliveries` table doubles as the job queue (`FOR UPDATE SKIP LOCKED`), so there is no Redis or queue library. |
| Users | Multi-user, single org. Roles: `admin`, `editor`. Admin invites teammates by email. |
| Email | SMTP (env-configured) for auth only: invites, password reset, magic links. No respondent emails. |
| AI | Not in v1. Scorecard definition is a clean, Zod-validated JSON schema so AI generation can slot in later. |
| PDF reports | Not in v1. |
| Integrations | Outbound webhooks only. |
| UI fidelity | Same layout and IA as the reference screenshots, own brand (name, logo, palette). |
| Brand | **OpenScore**, own primary colour (see §8). |
| Quality | Vitest for the scoring engine; GitHub Actions CI (typecheck, lint, test); Docker image to GHCR; `CLAUDE.md` + architecture notes. |

### Libraries

- **ORM:** Drizzle + drizzle-kit migrations
- **Validation:** Zod (shared by client and server)
- **Auth:** Better Auth (email/password, magic link, invitations)
- **Jobs:** the `webhook_deliveries` table polled by `worker/index.ts`
- **UI:** Tailwind v4, shadcn/ui (Radix), lucide-react, dnd-kit (reordering)
- **Builder state:** Zustand with an undo/redo history
- **Rich text (result copy):** Tiptap, limited to bold/italic/links/lists/headings

---

## 2. v1 Scope

### In
- Scorecard CRUD: create from scratch, rename, duplicate, delete, list (search, grid/list view).
- Question builder (full-screen, 3-pane) with all 11 question types (§4).
- Categories, overall + per-category scoring, score tiers (§5).
- Structured result page template with tier-specific content (§6).
- Lead form: configurable fields, consent modes, position before or after questions (§7).
- Draft/publish versioning with draft-mode test responses.
- Brand kits plus per-scorecard theme overrides.
- Public hosted URL and auto-resizing iframe embed.
- Responses list: table, detail view, CSV export, draft/live filter.
- Outbound webhooks: `lead.captured`, `response.completed`; HMAC signing; retries; deliveries recorded in the DB (no UI).
- Scorecard setup checklist (progress card in the sidebar).

### Out (deferred)
Landing-page section builder · jump-to branching · AI builder/chat · PDF reports · respondent emails
(result/abandon) · dashboard KPIs/insights charts · audiences/segmentation · A/B experiments ·
native CRM integrations · popup/slide-in widget · custom domains · multiple workspaces · billing.

---

## 3. Information architecture

Layout follows the reference screenshots.

**Top bar:** logo · scorecard switcher ▾ · `DRAFT` / `LIVE` pill · open-live-link icon · help · avatar menu.

**Global sidebar (no scorecard selected):** Scorecards · Brand kits · Settings (Organisation, Members) · Help.

**Scorecard sidebar:**
- Setup-progress card ("N of M steps", progress bar)
- Scorecard Setup (checklist page)
- Scorecard Home: preview thumbnail, URL, Publish button, response counts
- Responses
- **Build:** Questions · Result Page
- Share & Embed
- Integrate (Webhooks)
- **Settings:** General · Lead Form · Score Tiers · Share Appearance (OG title/description/image)

**Setup checklist steps:** Branding & theme → Questions & scoring → Score tiers → Result page →
Lead form → Preview & test in draft → Publish → Share/embed. Webhooks are optional and not counted.

**Create flow:** "Create Scorecard" → modal asking for the name (hint: punchy names like "The
Influence Scorecard") → builder. Scratch-only in v1 (no templates or AI).

### Builder (full screen)
- Header: back · scorecard name · content switcher (Questions / Result Page) · desktop/mobile toggle ·
  preview ▶ · settings ⚙ · undo/redo · **Save**.
- Left rail: Add question · Questions · Categories · Theme · Page settings.
- List pane: ordered questions (drag to reorder, validation-error state), "Add question"; a footer
  "Results" section linking to tiers and the result page.
- Canvas: live render of the selected question using the public renderer and active theme, with a
  progress bar.
- Right inspector: **Question** tab (type, show instruction, required, randomise answers, type-specific
  settings, category, media) and **Answers** tab (options, points, images).

---

## 4. Question types

| Type | Answer shape | Scoring |
|---|---|---|
| Yes / No / Maybe | one of yes/no/(maybe if enabled) | points per option |
| Multiple Choice – Buttons | single option | points per option |
| Multiple Choice – Radio | single option | points per option |
| Multiple Choice – Checkboxes | 0..n options (optional min/max selections) | sum of selected |
| Image Button | single option with image (optional multi-select) | points per option |
| Sliding Scale | number in [min, max] with step | value mapped linearly onto the points range |
| Linear Scale | integer in [min, max]; left/centre/right labels; starting value | value mapped onto the points range |
| Divided Scale | one of N labelled segments | points per segment |
| Numeric | number, optional min/max/unit | points from configured value ranges |
| Open Text | string (short or long) | unscored |
| Info Screen | none (content + continue button) | unscored, not counted in progress |
| Process Curve | integer in [min, max] **per step** (2–7 named steps) | each step mapped onto the points range, into its own category (§4.1) |

Common options: `required`, `showInstruction` + instruction text, `randomiseAnswers` (choice types),
media (image or video URL), `categoryId` (optional).

### 4.1 Process Curve

A "find the constraint" chart. The steps of a process (e.g. Leads → Sales calls → Onboarding →
Delivery → Invoicing) run left to right. The respondent drags each step's point between a bottom
label ("– Slow") and a top label ("+ Fast"). A smooth curve (monotone, so it never overshoots a
point) joins the points, shaded against a dotted midline. The lowest step is called out with the
constraint label ("▼ The constraint").

- **Owner settings:** 2–7 steps (label, optional category, starting value), integer scale min/max,
  points range, top and bottom labels, and the constraint label.
- **Answer:** `{ values: { [stepId]: number } }`. Created on the first drag or arrow-key press, then
  holds every step (unmoved steps keep their starting values). A **required** curve can't be
  submitted until the respondent has moved at least one point.
- **Constraint:** the step with the lowest value. **Ties go to the first** (leftmost) of the tied steps.
- **Accessibility:** every point is a `role="slider"` handle (arrow keys, Home/End), and points
  snap to integers.

---

## 5. Scoring engine

Pure, deterministic TypeScript module (`scoring/`), fully unit-tested, used by both server and
builder preview.

- Each scored question belongs to **at most one category**. Uncategorised scored questions count
  toward the overall score only. **Exception: Process Curve.** Each step is scored like its own
  linear-scale item (`maxPoints = steps × top of the points range`). Its points go to that step's
  category, if any, and always to the overall score. The question-level category is ignored.
- `maxPoints(question)`: the highest option for single-select types; the sum of positive options
  (respecting max selections) for checkboxes; the top of the points range for scales; the highest
  range value for numeric.
- Unanswered optional questions score 0 but **still count** toward the maximum.
- `overallPct = round(100 × Σ points / Σ maxPoints)`; same per category. A category with zero max
  is excluded.
- **Score tiers:** an ordered list covering 0–100 with no gaps or overlaps (validated), e.g.
  0–40 / 41–70 / 71–100. The overall % picks the tier. Each category resolves its own tier from the
  same tier ranges.
- Points are integers ≥ 0 in v1.
- Scores are computed server-side at completion against the response's **pinned version** and
  stored on the response. They are never recomputed silently.

---

## 6. Result page (structured template)

One result page per scorecard. Content varies by tier:

1. Header: logo, headline, overall score gauge (%), tier name. Tokens `{{firstName}}`, `{{lastName}}`,
   `{{score}}`, `{{tier}}` and `{{constraint}}` work in the headline, tier body, CTA text and category copy.
   Values are HTML-escaped. `{{constraint}}` is the constraint step of the first answered Process Curve.
2. Tier body: rich text per tier.
3. Category breakdown: one bar per category (%), with per-category, per-tier rich text.
4. Process curves: the respondent's own chart for each answered Process Curve, with the constraint
   marked (toggle: `showProcessCurves`, default on).
5. CTA block: per-tier button label + URL (e.g. "Book a call"), optional secondary text.
6. Footer.

Result URL: `/s/:slug/r/:resultToken`. The token is an unguessable random ID; the page is
shareable and `noindex`.

---

## 7. Respondent flow and lead form

`/s/:slug` → start screen (fixed template: logo, title, description, bullet list, Start button;
editable in Settings → General) → questions one per screen with Back/Next and a progress bar →
result page.

- **Lead form position** per scorecard: `before` (on the start screen, as in the reference) or
  `after` (gates the results).
- **Fields:** First name, Last name, Email by default (each can be made optional or disabled).
  "Add field" supports text, phone, dropdown, checkbox. Fields are drag-reorderable.
- **Consent:** Implied (no checkbox) · Explicit optional · Explicit required, plus a privacy
  statement and privacy policy URL.
- Partial progress is saved server-side per answer (needed for `lead.captured` and future
  abandon handling). The response ID lives in a cookie or localStorage so a refresh resumes.
- Draft scorecards are reachable only by signed-in users via preview; their responses get
  `isTest = true`.

### Embedding
- Public routes (`/s/*`, `/embed/*`) send no framing restriction, so they embed anywhere, including local
  `file://` test pages, which `frame-ancestors *` would block. Admin routes send `frame-ancestors 'none'`
  and `X-Frame-Options: DENY`.
- Snippet: `<iframe>` plus a small `/embed.js` that listens for `postMessage` height events to
  auto-resize.

---

## 8. Theming and design system

**Brand kit** (org-level, many): logo, primary colour, accent colour, text colour, background
colour/image, font (curated Google Fonts list or system), button radius, button style
(solid/outline). A scorecard picks a kit and may override individual fields.

**Admin UI tokens** (OpenScore's own identity; the layout follows the reference):
- Neutral greys, white surfaces, 1px `gray-200` borders, `rounded-lg` cards, subtle shadows on modals.
- Font: Inter (UI). Section labels in small caps tracking-wide (`BUILD`, `SETUP`).
- Primary: teal `#0D9488`, dark ink `#0F172A`.
- Status pills: Draft = amber, Live = green. "New" badge = violet.

---

## 9. Draft / publish versioning

- `scorecards.draftDefinition` (JSONB) is what the builder edits. Save is explicit, with dirty-state
  tracking and undo/redo in the client.
- **Publish** validates the draft (Zod plus business rules: tiers cover 0–100, every choice question
  has options, and so on) and inserts an immutable `scorecard_versions` row. `scorecards.liveVersionId`
  points at it.
- Responses store `versionId`. The detail view and CSV render against that version.
- "Unpublish" returns the public URL to a "not available" page. "Discard draft changes" resets the
  draft to the live definition.

---

## 10. Webhooks

Configured per scorecard (Integrate page): URL, events, enabled flag, and a secret (generated, can
be rotated).

**Events**
- `lead.captured`: when the lead form is submitted (before or after the questions).
- `response.completed`: on finish. Includes lead fields, every answer (question text, answer label
  and value, points), overall %, tier, category scores, result URL, `versionId`, `isTest`.

**Delivery**
- `POST` JSON. Headers: `OpenScore-Event`, `OpenScore-Delivery` (UUID),
  `OpenScore-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`.
- Success = 2xx within 10 s. Otherwise retry with backoff (1 m, 5 m, 30 m, 2 h, 6 h), then mark
  failed.
- Every attempt is stored in `webhook_deliveries` (status, response code, truncated body, timing).
  There is no UI in v1; a "Send test event" button is the only admin interaction.

---

## 11. Data model (sketch)

```
users, sessions, accounts, verifications, invitations   -- Better Auth
org_settings          (singleton: name, default brand kit)
brand_kits            (id, name, tokens jsonb)
scorecards            (id, slug unique, name, draft_definition jsonb, live_version_id,
                       brand_kit_id, theme_overrides jsonb, settings jsonb, created_by, timestamps)
scorecard_versions    (id, scorecard_id, version int, definition jsonb, published_by, published_at)
responses             (id, scorecard_id, version_id, result_token unique, is_test,
                       lead jsonb, consent jsonb, answers jsonb,
                       overall_pct, tier_id, category_scores jsonb,
                       started_at, lead_captured_at, completed_at, user_agent, referrer)
webhooks              (id, scorecard_id, url, secret, events text[], enabled, timestamps)
webhook_deliveries    (id, webhook_id, event, payload jsonb, attempt, status, http_status,
                       response_excerpt, duration_ms, next_attempt_at, created_at)
```

`definition` JSON holds questions, categories, tiers, the result page template, start screen,
lead form config, and Zod schema version.

---

## 12. Deployment

- One Docker image (multi-stage, Node LTS) with two commands: `web` and `worker`.
- `compose.yaml`: `postgres` (always), plus `web` and `worker` under the `app` profile (`docker compose --profile app up -d`).
- Env: `DATABASE_URL`, `APP_URL`, `AUTH_SECRET`, `SMTP_*`, `RUN_MIGRATIONS`. The first admin is created through the `/setup` page on a fresh install.
- Migrations run on `web` start (with a flag to disable).
- CI: typecheck, lint, Vitest on PRs; build and push `ghcr.io/<owner>/openscore` on main and tags.

---

## 13. Resolved defaults (2026-10-28)

1. **Templates:** none in v1; the create flow is "start from scratch". A dev seed script creates one example scorecard.
2. **Negative points:** not allowed; points are integers ≥ 0.
3. **Test responses and webhooks:** draft-mode test responses **do** fire webhooks, with `isTest: true`, so integrations can be tested before publishing.
4. **Data retention:** admins can delete one response or bulk-delete selected ones. No automatic retention period.
5. **Respondent page i18n:** English only in v1, with respondent-facing UI strings kept in one module for later.
6. **Visit tracking:** not in v1.
7. **Primary colour:** teal `#0D9488`, ink `#0F172A`.
8. **License:** keep Apache-2.0.
