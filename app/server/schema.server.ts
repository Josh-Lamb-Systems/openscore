import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Answers, Definition } from "~/lib/scorecard/schema";
import type { CategoryScore } from "~/lib/scoring/score";
import type { BrandTokens } from "~/lib/theme";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Auth (Better Auth core tables; column names follow Better Auth's field names)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** "admin" | "editor" */
  role: text("role").notNull().default("editor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------

/** Singleton row (id = "org"). */
export const orgSettings = pgTable("org_settings", {
  id: text("id").primaryKey().default("org"),
  name: text("name").notNull().default("My organisation"),
  defaultBrandKitId: text("default_brand_kit_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull().default("editor"),
  /** Random token sent in the invite link. */
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const brandKits = pgTable("brand_kits", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tokens: jsonb("tokens").$type<BrandTokens>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Scorecards
// ---------------------------------------------------------------------------

export interface ScorecardSettings {
  /** Share appearance (Open Graph). */
  shareTitle: string;
  shareDescription: string;
  shareImageUrl: string;
  /** Setup checklist steps the user ticked manually (see app/lib/scorecard/setup.ts). */
  completedSteps?: string[];
}

export const scorecards = pgTable("scorecards", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  draftDefinition: jsonb("draft_definition").$type<Definition>().notNull(),
  /** Bumped on every draft save; used to show "unpublished changes". */
  draftUpdatedAt: timestamp("draft_updated_at", { withTimezone: true }).notNull().defaultNow(),
  liveVersionId: text("live_version_id"),
  brandKitId: text("brand_kit_id").references(() => brandKits.id, { onDelete: "set null" }),
  themeOverrides: jsonb("theme_overrides").$type<Partial<BrandTokens>>().notNull().default({}),
  settings: jsonb("settings")
    .$type<ScorecardSettings>()
    .notNull()
    .default({ shareTitle: "", shareDescription: "", shareImageUrl: "" }),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const scorecardVersions = pgTable(
  "scorecard_versions",
  {
    id: text("id").primaryKey(),
    scorecardId: text("scorecard_id")
      .notNull()
      .references(() => scorecards.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    definition: jsonb("definition").$type<Definition>().notNull(),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("scorecard_versions_scorecard_version_idx").on(t.scorecardId, t.version)],
);

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface ResponseConsent {
  mode: "implied" | "explicit_optional" | "explicit_required";
  given: boolean;
  at: string | null;
}

export const responses = pgTable(
  "responses",
  {
    id: text("id").primaryKey(),
    scorecardId: text("scorecard_id")
      .notNull()
      .references(() => scorecards.id, { onDelete: "cascade" }),
    /**
     * The published version answered against. Null for draft-mode test responses,
     * which snapshot the draft definition into `testDefinition` instead.
     */
    versionId: text("version_id").references(() => scorecardVersions.id, { onDelete: "restrict" }),
    testDefinition: jsonb("test_definition").$type<Definition>(),
    isTest: boolean("is_test").notNull().default(false),
    /** Unguessable token used in the public result URL. */
    resultToken: text("result_token").notNull().unique(),
    lead: jsonb("lead").$type<Record<string, string | boolean>>().notNull().default({}),
    email: text("email"),
    consent: jsonb("consent").$type<ResponseConsent>(),
    answers: jsonb("answers").$type<Answers>().notNull().default({}),
    overallPercent: integer("overall_percent"),
    points: jsonb("points").$type<{ points: number; maxPoints: number }>(),
    tierId: text("tier_id"),
    categoryScores: jsonb("category_scores").$type<CategoryScore[]>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    leadCapturedAt: timestamp("lead_captured_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: updatedAt(),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
  },
  (t) => [
    index("responses_scorecard_started_idx").on(t.scorecardId, t.startedAt),
    index("responses_email_idx").on(t.email),
  ],
);

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export type WebhookEvent = "lead.captured" | "response.completed";

export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  scorecardId: text("scorecard_id")
    .notNull()
    .references(() => scorecards.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").array().$type<WebhookEvent[]>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Doubles as the delivery queue: the worker claims rows where status = 'pending'
 * and next_attempt_at <= now() using FOR UPDATE SKIP LOCKED.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: text("event").$type<WebhookEvent | "ping">().notNull(),
    payload: jsonb("payload").notNull(),
    /** "pending" | "succeeded" | "failed" */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastHttpStatus: integer("last_http_status"),
    lastError: text("last_error"),
    lastResponseExcerpt: text("last_response_excerpt"),
    lastDurationMs: integer("last_duration_ms"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("webhook_deliveries_due_idx")
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);
