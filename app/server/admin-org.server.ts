import { and, asc, count, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { INVITE_TTL_DAYS } from "~/lib/admin/members";
import { DEFAULT_BRAND_TOKENS, type BrandTokens } from "~/lib/theme";
import { db, schema } from "./db.server";
import { sendEmail } from "./email.server";
import { appUrl } from "./env.server";
import { createId, createToken } from "./ids.server";

// ---------------------------------------------------------------------------
// Organisation settings (singleton row)
// ---------------------------------------------------------------------------

export async function getOrgSettings() {
  const [org] = await db.select().from(schema.orgSettings).limit(1);
  return org ?? { id: "org", name: "My organisation", defaultBrandKitId: null as string | null };
}

export async function updateOrgSettings(patch: Partial<{ name: string; defaultBrandKitId: string | null }>) {
  await db
    .insert(schema.orgSettings)
    .values({ id: "org", name: patch.name ?? "My organisation", defaultBrandKitId: patch.defaultBrandKitId ?? null })
    .onConflictDoUpdate({ target: schema.orgSettings.id, set: patch });
}

// ---------------------------------------------------------------------------
// Brand kits
// ---------------------------------------------------------------------------

export async function listBrandKits() {
  const kits = await db.select().from(schema.brandKits).orderBy(asc(schema.brandKits.name));
  const usage = await db
    .select({ kitId: schema.scorecards.brandKitId, n: count() })
    .from(schema.scorecards)
    .groupBy(schema.scorecards.brandKitId);
  const used = new Map(usage.map((u) => [u.kitId, u.n]));
  return kits.map((k) => ({ ...k, scorecardCount: used.get(k.id) ?? 0 }));
}

export async function createBrandKit(name: string, tokens: BrandTokens = DEFAULT_BRAND_TOKENS) {
  const [kit] = await db
    .insert(schema.brandKits)
    .values({ id: createId("kit"), name, tokens })
    .returning();
  return kit;
}

export async function updateBrandKit(id: string, patch: Partial<{ name: string; tokens: BrandTokens }>) {
  await db.update(schema.brandKits).set(patch).where(eq(schema.brandKits.id, id));
}

/** Scorecards using the kit fall back to the default theme (ON DELETE SET NULL). */
export async function deleteBrandKit(id: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.orgSettings)
      .set({ defaultBrandKitId: null })
      .where(eq(schema.orgSettings.defaultBrandKitId, id));
    await tx.delete(schema.brandKits).where(eq(schema.brandKits.id, id));
  });
}

// ---------------------------------------------------------------------------
// Members & invitations
// ---------------------------------------------------------------------------

export type Role = "admin" | "editor";

export function isRole(v: string): v is Role {
  return v === "admin" || v === "editor";
}

export async function listMembers() {
  return db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .orderBy(asc(schema.user.createdAt));
}

async function otherAdminCount(userId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.user)
    .where(and(eq(schema.user.role, "admin"), ne(schema.user.id, userId)));
  return n;
}

export async function getMember(id: string) {
  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, id)).limit(1);
  return u ?? null;
}

/** Returns an error message, or null on success. */
export async function changeMemberRole(id: string, role: Role): Promise<string | null> {
  const member = await getMember(id);
  if (!member) return "That member no longer exists.";
  if (member.role === "admin" && role !== "admin" && (await otherAdminCount(id)) === 0) {
    return "There must be at least one admin.";
  }
  await db.update(schema.user).set({ role, updatedAt: new Date() }).where(eq(schema.user.id, id));
  return null;
}

/** Removes a member (sessions and accounts cascade). Returns an error message, or null. */
export async function removeMember(id: string, currentUserId: string): Promise<string | null> {
  if (id === currentUserId) return "You can't remove yourself.";
  const member = await getMember(id);
  if (!member) return null;
  if (member.role === "admin" && (await otherAdminCount(id)) === 0) return "There must be at least one admin.";
  await db.delete(schema.user).where(eq(schema.user.id, id));
  return null;
}

export { INVITE_TTL_DAYS };

export function inviteUrl(token: string): string {
  return appUrl(`/invite/${token}`);
}

export async function listPendingInvitations() {
  return db
    .select({
      id: schema.invitations.id,
      email: schema.invitations.email,
      role: schema.invitations.role,
      token: schema.invitations.token,
      expiresAt: schema.invitations.expiresAt,
      createdAt: schema.invitations.createdAt,
      invitedBy: schema.user.name,
    })
    .from(schema.invitations)
    .leftJoin(schema.user, eq(schema.user.id, schema.invitations.invitedBy))
    .where(and(isNull(schema.invitations.acceptedAt), gt(schema.invitations.expiresAt, new Date())))
    .orderBy(desc(schema.invitations.createdAt));
}

/** Creates an invitation and emails the link. Returns an error message, or null. */
export async function inviteMember(
  email: string,
  role: Role,
  invitedBy: { id: string; name: string },
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, normalized))
    .limit(1);
  if (existing) return "That person is already a member.";

  // Replace any earlier pending invitation for the same address.
  await db
    .delete(schema.invitations)
    .where(and(eq(schema.invitations.email, normalized), isNull(schema.invitations.acceptedAt)));

  const token = createToken();
  await db.insert(schema.invitations).values({
    id: createId("inv"),
    email: normalized,
    role,
    token,
    invitedBy: invitedBy.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  const org = await getOrgSettings();
  await sendEmail({
    to: normalized,
    subject: `${invitedBy.name} invited you to ${org.name} on OpenScore`,
    text: `${invitedBy.name} invited you to join ${org.name} on OpenScore as ${role === "admin" ? "an admin" : "an editor"}.\n\nAccept the invitation: ${inviteUrl(token)}\n\nThis link expires in ${INVITE_TTL_DAYS} days.`,
  });
  return null;
}

export async function revokeInvitation(id: string) {
  await db.delete(schema.invitations).where(eq(schema.invitations.id, id));
}
